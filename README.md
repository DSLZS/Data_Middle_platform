# Data_Middle_platform
## 涉及的所有表及结构
### 1. bfmap_ways — 道路路段表（路网拓扑核心）
| 字段 | 类型 | 说明 |
|------|------|------|
| gid | bigint PK | 全局唯一标识 |
| osm_id | bigint | OSM 原始 ID |
| class_id | integer | 道路分类 ID |
| source | bigint | 起点节点 ID（关联 nodes 表） |
| target | bigint | 终点节点 ID（关联 nodes 表） |
| length | double precision | 路段长度 |
| reverse | double precision | 正反向权重 |
| maxspeed_forward | integer | 正向限速 |
| maxspeed_backward | integer | 反向限速 |
| priority | double precision | 路由优先级 |
| geom | geometry(LineString,4326) | 路段几何线 |
用途：哈尔滨城市路网拓扑数据，描述道路路段及其连接关系，是路径规划和地图匹配的基础路网。
