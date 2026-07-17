# Go Group Commit 调研：把并发请求聚合为一批提交

调研日期：2026-07-15。

## 结论

首选 [go.vallahaye.net/batcher](https://github.com/vallahaye/go-batcher)（`go.vallahaye.net/batcher`，当前 `v0.8.0`）。它与这里的需求最匹配：多个 goroutine 通过 `Send` 提交值，达到**批量上限或超时**时调用一次泛型 `CommitFunc[T, R]`；每个调用方都能独立等待自己的结果或错误。

它适合把多条业务请求合并为一次 DB bulk insert、Redis pipeline 或 HTTP bulk API 调用。建议配置为“最多 500 条，首条进入后最多等待 10 秒”，即 `batcher.New(commit, 500, 10*time.Second)`。高流量下按 500 条提前刷批，低流量下在 10 秒内刷出尾批。

需要注意：该版本要求 Go 1.24；它是**进程内**聚合器，不是 Kafka，也不提供磁盘持久化、跨实例合并、重试或幂等保障。若需要这些能力，应先写入 Kafka/DB outbox，再由消费者批量提交。

## 需求边界

这里的 group commit 指单个 Go 进程内的微批（micro-batch）：

```text
并发请求 Send(T) --> 内存批次 [T, T, ...] --> BulkFn([]T)
       ^                                               |
       +--------- 每条 Operation 独立收到 R / error ---+
```

- 触发条件：达到 `maxBatchSize` **或**等待 `maxWait`，以先到者为准。
- 时间窗口：首条数据进入一个空批次后开始计时；不是无论是否有数据都每 10 秒执行一次。
- 调用方语义：同步 HTTP/RPC 请求通常应等待其对应操作完成；日志、埋点等可只入队、不等待结果。
- 聚合范围：同一批内的操作应具有相同的目标、认证、事务语义和处理方式。不同表、不同租户或不同 HTTP endpoint 应使用不同 batcher，或先按 key 分片。

10 秒是很长的同步请求等待时间。若上游 HTTP 超时小于 10 秒，请求会先返回超时，而操作仍可能在后续批次写入。因此，面向用户请求通常取 10--100 ms；10 秒更适合异步写入、后台任务或能接受最终一致性的场景。

## 候选项目

| 项目 | 泛型 / 最低 Go | 刷批机制 | 单请求结果 | 许可 | 判断 |
| --- | --- | --- | --- | --- | --- |
| [vallahaye/go-batcher](https://github.com/vallahaye/go-batcher) | `T, R any`；Go 1.24 | 条数、首条后的超时 | 支持 `Operation.Wait(ctx)`，可逐条成功/失败 | Apache-2.0 | **首选**。接口与 group commit 一致，零运行时依赖，批处理函数能为每条请求回填结果。 |
| [naughtygopher/nibbler](https://github.com/naughtygopher/nibbler) | `T any`；Go 1.23.1 | ticker、条数 | 不支持逐条返回值；只报告整批处理错误 | MIT | 适合异步批量写事件、埋点和日志；有处理超时、panic/error hook、是否继续消费等配置。 |
| [serkodev/aggregator](https://github.com/serkodev/aggregator) | `K, V any`；Go 1.18 | 超时、条数 | 按 key 返回值 | MIT | 更像 DataLoader：适合合并 `SELECT ... WHERE id IN (...)`、缓存读取和同 key 去重，不适合作为通用批量写提交器；README 标注 beta，最近模块版本为 2022 年。 |
| [audipasuatmadi/go-microbatch](https://github.com/audipasuatmadi/go-microbatch) | `T any`；Go 1.21.5 | 超时、条数 | 消费者自行 `ReadData` | MIT | 很小的队列/读批组件。需要自行维护 worker、错误处理、关停和结果回传，作为基础积木可用。 |
| [samber/go-singleflightx](https://github.com/samber/go-singleflightx) | `K, V any`；Go 1.18 | 并发相同 key 的合并 | 按 key 返回值 | MIT | 解决的是同 key 重复读的 singleflight/DataLoader 问题，不是按 10 秒聚合写入；可与 batcher 组合用于读路径。 |

对比时也排除了两个常被搜到但不满足需求的项目：

- [pacedotdev/batch](https://github.com/pacedotdev/batch) 只把一个**已有 slice**切分后顺序处理，没有跨请求聚合、定时器或泛型。
- [jakewins/4fq](https://github.com/jakewins/4fq) 是高性能队列，可批量取走当前消息，但没有定时刷批和泛型结果回传；更适合极高吞吐的底层队列场景。

## 推荐接入方式

安装并固定到当前稳定版本：

```bash
go get go.vallahaye.net/batcher@v0.8.0
```

下面的骨架以批量 HTTP/DB/Redis 写入为例。`WriteOne` 对调用方看起来仍是一次普通调用，但实际会与同时到来的请求合并。

```go
package bulk

import (
    "context"
    "errors"
    "time"

    "go.vallahaye.net/batcher"
)

type Write struct {
    Key   string
    Value []byte
}

type Result struct {
    Version string
}

type Service struct {
    writes *batcher.Batcher[Write, Result]
}

func NewService(serviceCtx context.Context) *Service {
    commit := func(ctx context.Context, ops batcher.Operations[Write, Result]) {
        // Batch() 在关停时可能传入已取消的 ctx；提交使用独立、有限的 deadline。
        flushCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 15*time.Second)
        defer cancel()

        values := make([]Write, len(ops))
        for i, op := range ops {
            values[i] = op.Value
        }

        // bulkWrite 必须能按输入顺序或按 Key 对应地给出每条结果。
        results, err := bulkWrite(flushCtx, values)
        if err != nil {
            ops.SignalError(err)
            return
        }
        if len(results) != len(ops) {
            ops.SignalError(errors.New("bulk write returned incomplete results"))
            return
        }
        for i, op := range ops {
            op.SignalResult(results[i])
        }
    }

    b := batcher.New(commit, 500, 10*time.Second)
    go b.Batch(serviceCtx) // serviceCtx 由进程生命周期控制，不能用某个请求的 ctx。
    return &Service{writes: b}
}

func (s *Service) WriteOne(ctx context.Context, value Write) (Result, error) {
    op, err := s.writes.Send(ctx, value)
    if err != nil {
        return Result{}, err
    }
    return op.Wait(ctx)
}
```

`bulkWrite` 可以分别实现为：

- DB：`INSERT ... VALUES (...), (...)`、数据库 driver 的 bulk API，或一批事务中的多次语句；需决定整批失败是否全部失败，还是根据数据库返回逐条标记。
- Redis：同一连接上的 pipeline；`EXEC` 后按命令索引把每个命令的结果回填到对应 `Operation`。
- HTTPS：优先调用下游原生 bulk endpoint；若下游只有单条 API，仍可在 commit 中使用受限并发发送，但这只能减少本地调度，不能减少 HTTP 请求数。

## 必须定义的语义

### 背压与容量

该 batcher 的入站 channel 无缓冲：当刷批函数执行时，新的 `Send` 会阻塞到下一批开始接收，直到调用方的 context 到期。这提供天然背压，但需要为 `Send` 和 `Wait` 设置 deadline，并监控等待时间和超时数。

`maxBatchSize` 同时是单批内存上界。按记录大小和下游限制设定，例如 HTTP body、SQL 参数个数、Redis pipeline 命令数都可能限制批量大小；不要只设 10 秒而不设条数上限。

### 失败、超时与幂等

- `Send` 成功后，调用方的 `Wait(ctx)` 即使超时，也**不会撤回**已经入队的操作；它随后仍可能提交成功。
- 因此每个写操作需要业务幂等键（如 `request_id`、唯一业务主键或下游的 idempotency key），重试不能只依赖客户端是否收到响应。
- `CommitFunc` 对每个操作必须恰好调用一次 `SignalResult` 或 `SignalError`；漏掉任何一个会使该请求永久等待到自身超时。
- 整批调用失败时可用 `ops.SignalError(err)`；部分成功时要逐条 signal。重试应放在 bulk 函数内或外围 worker 中，并设置次数、退避和死信/告警策略。

### 生命周期

进程关闭时取消传给 `Batch` 的服务级 context。该库会尝试对尚未提交的尾批再调用一次 commit，但该调用收到的 context 可能已经取消；示例因此用 `context.WithoutCancel` 另建一个有上限的 flush context。关停窗口必须大于该 flush deadline，之后再关闭 DB、Redis 或 HTTP transport。

该项目没有 `Close` 方法、持久化队列或跨进程协调。若“机器重启也不能丢”“多个 Pod 必须聚成同一批”是需求的一部分，应使用 Kafka、Redis Streams、数据库 outbox 或专用任务队列承接写入，再在消费者侧批量落库。

## 落地检查项

- [ ] 为每种目标（表/Redis cluster/HTTP endpoint）创建独立或按 key 分片的 batcher。
- [ ] 配置 `maxBatchSize`、`maxWait`、flush deadline 和上游请求 deadline，并确认它们的大小关系。
- [ ] 为每条操作提供幂等键，明确整批和部分失败的重试策略。
- [ ] 记录 batch size、按容量/按超时刷批次数、排队等待、flush 耗时、逐条成功率、重试和丢弃数。
- [ ] 压测低流量尾批、高并发满批、下游缓慢、部分失败、客户端超时和进程关闭场景。

## 参考资料

- [vallahaye/go-batcher README 与源码](https://github.com/vallahaye/go-batcher)（模块 `v0.8.0`；`go.mod` 声明 Go 1.24）
- [naughtygopher/nibbler README 与源码](https://github.com/naughtygopher/nibbler)（模块 `v0.2.2`；`go.mod` 声明 Go 1.23.1）
- [serkodev/aggregator README 与源码](https://github.com/serkodev/aggregator)（模块 `v0.0.3`；`go.mod` 声明 Go 1.18）
- [audipasuatmadi/go-microbatch README 与源码](https://github.com/audipasuatmadi/go-microbatch)
- [samber/go-singleflightx README 与源码](https://github.com/samber/go-singleflightx)（模块 `v0.3.2`）
- [Go Module Reference: go.vallahaye.net/batcher](https://pkg.go.dev/go.vallahaye.net/batcher)
