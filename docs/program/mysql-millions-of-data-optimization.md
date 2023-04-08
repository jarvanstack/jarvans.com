# MySQL千万数据查询优化之路

本文主要针对 MySQL 在千万级别数据的分页查询性能进行优化, 下面是整个优化的过程.

## 先说结论

先说结论, MySQL 在千万级别数据的分页查询性能主要受到 2 个因素的影响:

* 查询的偏移量
* 查询的数据量

### 查询的偏移量优化

当 MySQL 执行查询语句分页 `LIMIT` 时, 有 2 个步骤需要先按照指定的排序规则对数据进行排序, 然后跳过指定的偏移量。

如果查询的偏移量比较大, 那么排序的时间就会比较长(B+树 索引可以极大优化该阶段性能)

但是 B+树 在跳过指定的偏移量时, 需要顺序遍历, O(n) 的复杂度, 千万级的偏移量也是比较慢

优化思路:

* 给排序的字段加上B+树索引
* 使用子查询确定查询范围(比如, 主键的范围, `BETWEEN` 等)
* 连表查询, 小表驱动大表, 通过小表的索引来确定大表的范围, 减少偏移量

### 查询的数据量优化

* 指定列替代 `SELECT *`
* 减少不需要的列, 特别是大字段
* 一次尽可能按需查询较少的数据条数
* 缓存查询结果 (比如 redis) 来减少查询次数


## 准备数据

### 建表

```sql
CREATE TABLE `big_tables` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(256) DEFAULT NULL,
  `age` bigint DEFAULT NULL,
  `data` longblob,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=10010001 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

### 导入数据

我使用的是 golang gorm 来导入数据, 代码如下:

```go
var (
	configFile = "../config-dev.yaml"
	DB         *gorm.DB
)

type BigTable struct {
	ID   uint64 `gorm:"column:id;primary_key;auto_increment"`
	Name string `gorm:"column:name"`
	Age  int    `gorm:"column:age"`
	Data []byte `gorm:"column:data"`
}

func TestBitTable_InsertData(t *testing.T) {
	var err error

	DB.AutoMigrate(&BigTable{})

	// 关闭日志
	DB.Logger = logger.Default.LogMode(logger.Silent)

	// 批量插入 1000w 条数据, 每次插入 10000 条
	batches := 1000
	size := 10_000
	bigTables := make([]*BigTable, 0, size)
	for i := 0; i < batches; i++ {
		for i := 0; i < size; i++ {
			bigTables = append(bigTables, &BigTable{
				Name: utils.RandString(10),
				Age:  utils.RandInt(10),
				Data: utils.RandBytes(10),
			})
		}
		var task = func(idx int, db *gorm.DB) {
			err = db.CreateInBatches(bigTables, size).Error
			if err != nil {
				t.Error(err)
			}
			log.Printf("批次: %v, 完成 \n", idx)
		}

		task(i, DB)

		// 清空
		bigTables = bigTables[:0]
	}

	log.Printf("\n插入完成\n")
}
```

一分钟左右就可以导入 1000w 条数据

### 查看导入的数据


```bash
mysql> select count(*) from big_tables;
+----------+
| count(*) |
+----------+
| 10010000 |
+----------+
1 row in set (1.27 sec)
```



## 普通查询

### 查询 offset 为 1w, 10w, 100w, 1000w 的 1 条数据

命令

```sql
select * from big_tables limit 10000, 1;
select * from big_tables limit 100000, 1;
select * from big_tables limit 1000000, 1;
select * from big_tables limit 10000000, 1;
```

结果

```sql
mysql> select * from big_tables limit 10000, 1;
+-------+------------+-----+------------+
| id    | name       | age | data       |
+-------+------------+-----+------------+
| 10001 | I6pC5NBFD9 |   7 | x4zXHhnPnW |
+-------+------------+-----+------------+
1 row in set (0.10 sec)

mysql> select * from big_tables limit 100000, 1;
+--------+------------+-----+------------+
| id     | name       | age | data       |
+--------+------------+-----+------------+
| 100001 | PzpzEZDX9G |   0 | B48IvBLlWo |
+--------+------------+-----+------------+
1 row in set (0.13 sec)

mysql> select * from big_tables limit 1000000, 1;
+---------+------------+-----+------------+
| id      | name       | age | data       |
+---------+------------+-----+------------+
| 1000001 | 4niiNSTHtx |   5 | tdCK9VuVWJ |
+---------+------------+-----+------------+
1 row in set (0.52 sec)

mysql> select * from big_tables limit 10000000, 1;
+----------+------------+-----+------------+
| id       | name       | age | data       |
+----------+------------+-----+------------+
| 10000001 | R0HWlAyf7R |   0 | kHDTpsmtcg |
+----------+------------+-----+------------+
1 row in set (5.86 sec)
```

表格:

| 偏移量 | 查询时间 |
| --- | --- |
| 1w | 0.10s |
| 10w | 0.13s |
| 100w | 0.52s |
| 1000w | 5.86s |

可以看到 1w 到 10w 的查询时间基本不变, 但是 100w 到 1000w 的查询时间基本线性增长

因为 **B+树 在跳过指定的偏移量时, 需要顺序遍历, O(n) 的复杂度**

### 查询 offset 为 10, 100, 1000, 10000 条数据

命令

```sql
select * from big_tables limit 100000, 10;
select * from big_tables limit 100000, 100;
select * from big_tables limit 100000, 1000;
select * from big_tables limit 100000, 10000;
```

结果

```sql
mysql> select * from big_tables limit 100000, 10;
# 数据太多, 省略
10 rows in set (0.21 sec)

mysql> select * from big_tables limit 100000, 100;
# 数据太多, 省略
100 rows in set (0.35 sec)

mysql> select * from big_tables limit 100000, 1000;
# 数据太多, 省略
1000 rows in set (1.93 sec)

mysql> select * from big_tables limit 100000, 10000;
# 数据太多, 省略
10000 rows in set (21.20 sec)
```

表格

| 数据量 | 查询时间 |
| --- | --- |
| 10 | 0.21s |
| 100 | 0.35s |
| 1000 | 1.93s |
| 10000 | 21.20s |

可以看到, 数据量越大, 查询时间越长. 数据 1000-10000 的查询时间基本线性增长 (这里我的 MySQL 就在本机上, 如果是远程 MySQL 网络 IO 产生的时间将更长)

> 但是一般查询的数据量不会太大, 一般都是 10 条左右

优化方案如下:

* 指定列替代 `SELECT *`
* 减少不需要的列, 特别是大字段
* 一次尽可能按需查询较少的数据条数
* 缓存查询结果 (比如 redis) 来减少查询次数

> 优化方案比较简单, 容易理解, 后面就不再赘述了

## 优化: 偏移量导致的查询慢

#### 1. 子查询

先查询 id 的位置, 然后再根据 id 的位置查询数据

命令

```sql
select * from big_tables where id >= (
    select id from big_tables limit 10000000, 1
) limit 0, 1;
```

结果

```sql
mysql> select * from big_tables where id >= (
    select id from big_tables limit 10000000, 1
) limit 0, 1;
+----------+------------+-----+------------+
| id       | name       | age | data       |
+----------+------------+-----+------------+
| 10000001 | R0HWlAyf7R |   0 | kHDTpsmtcg |
+----------+------------+-----+------------+
1 row in set (2.69 sec)
```

表格

| 是否使用子查询 | 偏移量 | 查询时间 |
| --- | --- | --- |
| 是 | 1000w | 2.69s |
| 否 | 1000w | 5.86s |

可以看到, 使用子查询后, 查询时间减少了50%以上.

但是还是在秒级别, 达不到毫秒级别的业务需求


### 2. 子查询 EXPLAIN 分析


子查询命令

```sql
explain select * from big_tables where id >= (
    select id from big_tables limit 10000000, 1
) limit 0, 1;
```

结果

```bash
mysql> explain select * from big_tables where id >= (
    select id from big_tables limit 10000000, 1
) limit 0, 1;
+----+-------------+------------+------------+-------+---------------+---------+---------+------+---------+----------+-------------+
| id | select_type | table      | partitions | type  | possible_keys | key     | key_len | ref  | rows    | filtered | Extra       |
+----+-------------+------------+------------+-------+---------------+---------+---------+------+---------+----------+-------------+
|  1 | PRIMARY     | big_tables | NULL       | range | PRIMARY       | PRIMARY | 8       | NULL |   19290 |   100.00 | Using where |
|  2 | SUBQUERY    | big_tables | NULL       | index | NULL          | PRIMARY | 8       | NULL | 9750719 |   100.00 | Using index |
+----+-------------+------------+------------+-------+---------------+---------+---------+------+---------+----------+-------------+
2 rows in set (3.20 sec)
```

子查询(第二行):

* 子查询的 `type` 是 **index**, 表示使用了索引扫描全表
* 子查询的 `key` 是 **PRIMARY**, 表示使用了主键索引
* 子查询的 `rows` 是 **9750719**, 表示扫描了 9750719 行数据 (粗略计算的, 因为 MySQL 每页 16KB)
* 子查询的 `Extra` 是 **Using index**, 表示使用了覆盖索引

主查询(第一行):

* 主查询 `type` 是 **range**, 表示使用了索引范围扫描
* 主查询 `key` 是 **PRIMARY**, 表示使用了主键索引
* 主查询 `rows` 是 **19290**, 表示扫描了 19290 行数据
* 主查询 `Extra` 是 **Using where**, 表示使用了 where 条件

> 从上面可以看出: **子查询使用了索引扫描全表, 扫描行数量千万级别, 所以查询时间很长**



### 给主键加上唯一索引

给主键加上 B+树 的唯一索引

命令

```sql
# add unique index
alter table big_tables add unique index id(id) using btree;
# query2
select * from big_tables where id >= (
    select id from big_tables limit 10000000, 1
) limit 0, 1;
# explain query2
explain select * from big_tables where id >= (
    select id from big_tables limit 10000000, 1
) limit 0, 1;
```

结果

```bash
mysql> # add unique index
alter table big_tables add unique index id(id) using btree;
Query OK, 0 rows affected (35.82 sec)
Records: 0  Duplicates: 0  Warnings: 0

mysql> # query2
select * from big_tables where id >= (
    select id from big_tables limit 10000000, 1
) limit 0, 1;
+----------+------------+-----+------------+
| id       | name       | age | data       |
+----------+------------+-----+------------+
| 10000001 | R0HWlAyf7R |   0 | kHDTpsmtcg |
+----------+------------+-----+------------+
1 row in set (1.25 sec)
mysql> # explain query2
explain select * from big_tables where id >= (
    select id from big_tables limit 10000000, 1
) limit 0, 1;
+----+-------------+------------+------------+-------+---------------+---------+---------+------+---------+----------+-------------+
| id | select_type | table      | partitions | type  | possible_keys | key     | key_len | ref  | rows    | filtered | Extra       |
+----+-------------+------------+------------+-------+---------------+---------+---------+------+---------+----------+-------------+
|  1 | PRIMARY     | big_tables | NULL       | range | PRIMARY,id    | PRIMARY | 8       | NULL |   19290 |   100.00 | Using where |
|  2 | SUBQUERY    | big_tables | NULL       | index | NULL          | id      | 8       | NULL | 9750719 |   100.00 | Using index |
+----+-------------+------------+------------+-------+---------------+---------+---------+------+---------+----------+-------------+
2 rows in set (1.47 sec)

```

表格

| 状态 | 偏移量 | 查询时间 |
| --- | --- | --- |
| 不用子查询 | 1000w | 5.86s |
| 子查询 | 1000w | 2.69s |
| 子查询 + 唯一索引 | 1000w | 1.25s |

可以看到, 给主键加上唯一索引后, 查询时间减少了50%以上

### 如果主键不是递增的, 比如是字符串, 需要用 IN 查询

> 因为某些 mysql 版本不支持在 in 子句中使用 limit, 所以这里多嵌套了一层子查询

```sql
select * from big_tables where id in (
    select id from (
        select id from big_tables limit 10000000, 1
    ) as t
) limit 0, 1;
```


### 如果主键是线性递增, 可以使用 WHERE 优化

上面我们知道, 查询的消耗主要是在索引遍历的过程中, 如果id是连续递增的, 可以使用 WHERE 来优化

```sql
# query3
select * from big_tables where id >= 10000000 limit 0, 1;
# explain query3
explain select * from big_tables where id >= 10000000 limit 0, 1;
```

结果

```bash
mysql> # query3
select * from big_tables where id >= 10000000 limit 0, 1;
+----------+------------+-----+------------+
| id       | name       | age | data       |
+----------+------------+-----+------------+
| 10000000 | Hey8TWX966 |   7 | kSjxDkL1qj |
+----------+------------+-----+------------+
1 row in set (0.08 sec)

mysql> # explain query3
explain select * from big_tables where id >= 10000000 limit 0, 1;
+----+-------------+------------+------------+-------+---------------+---------+---------+------+-------+----------+-------------+
| id | select_type | table      | partitions | type  | possible_keys | key     | key_len | ref  | rows  | filtered | Extra       |
+----+-------------+------------+------------+-------+---------------+---------+---------+------+-------+----------+-------------+
|  1 | SIMPLE      | big_tables | NULL       | range | PRIMARY,id    | PRIMARY | 8       | NULL | 19298 |   100.00 | Using where |
+----+-------------+------------+------------+-------+---------------+---------+---------+------+-------+----------+-------------+
1 row in set (0.13 sec)
```

性能从原来的 5.86s 降低到了 0.08s, 提升 73 倍.

> 因为 `rows` 扫描行数不再是千万级别, 而只有一页的大小


## 为什么给主键加上唯一索引查询更快

在 MySQL 中，新增的唯一索引需要查询 2 次，第一次是查询索引树，第二次是查询数据页，而主键索引是唯一索引，所以查询主键索引时，只需要查询一次索引树即可。

但是在测试中, 1000万的偏移量的查询下, 再给主键加上唯一索引查询更快, 这是为什么呢?

参考:

* https://dba.stackexchange.com/questions/290617/why-does-mysql-workbench-let-me-add-unique-indexes-to-primary-keys
* https://stackoverflow.com/questions/75937219/why-add-unique-index-to-primary-index-is-faster

