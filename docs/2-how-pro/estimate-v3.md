# 封底估算能解决所有的高性能问题


我问一个程序员：“这个功能能扛多少 QPS？”

他说：“不知道，不压测怎么可能算出来？等上线以后再看吧。”

这就是大部分程序员的现状：**他们认为封底估算是不可能的，所以会逃避这个事情。**

> 一个土木工程师。他知道自己造的是浮桥、坚固一些的石桥，还是能用百年的海湾大桥。
> 
> 花的时间不一样，材料不一样，坚固程度也不一样。
> 
> 土木工程师不会说：“不知道，等造好再看看。”


## 1. 找到木桶最短板

一个功能经过的内存、Redis、MySQL 和下游接口，都是木桶的一块木板。最短的那块，决定了这个功能能承载的最高 QPS。


最简单的估算：

| 组件     | 简单估算                        |
| -------- | ------------------------------- |
| 本机内存 | 100W QPS                        |
| Redis    | 10W QPS；单个热 Key 到 1000 QPS |
| MySQL    | 1000 QPS; 单个热 Key 到 10 QPS  |


## 3. 很难, 但别交白卷

**封底估算这一招理论上能解决所有的高性能问题**

我见过的优秀的程序员，没有一个是不做封底估算的

但是没有人能100%地把这一招用出来，因为这一招其实非常难。

因为他比较难，很多程序员看到直接就放弃思考了，他们选择交了一张白卷。

我认为**最重要的是不要交白卷, 因为交白卷就没法进步了。**


## 参考

Redis 官方压测：
https://redis.io/docs/latest/operate/oss_and_stack/management/optimization/benchmarks/

4 核 16 GB 云 MySQL 的 Sysbench 测试：
https://www.orczhou.com/index.php/cloud-database-performance-rds-mysql/

Jarvan 封底估算--投资与写程序的共同心法:

https://mp.weixin.qq.com/s/CKwUuveh6VnJ1kspxOB2zg

10·10无锡高架桥侧翻事故
https://baike.baidu.com/item/10%C2%B710%E6%97%A0%E9%94%A1%E9%AB%98%E6%9E%B6%E6%A1%A5%E4%BE%A7%E7%BF%BB%E4%BA%8B%E6%95%85/23794275


段永平投资问答录