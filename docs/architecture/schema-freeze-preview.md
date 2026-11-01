# 《列国策》事件 Schema v1 冻结预览稿

> 程基岩 · engineering-lead · ARCH-007（Deliverable B）· **ARCH-010 修订（trace 增补 ref_goal_id（GDD-S12 Q3）、信封增补 stratum 字段位（TASK-010/S11））**
> 输入：ADR-001/002/003/005/006 + ARCH-002~010 全部 schema 决定 + GDD-S1/S2/S3/S7/S12 数据规格 + TASK-010（stratum 分层）
> **状态：预览稿——待主理人过目后正式冻结**（建议时点：Sprint 2 末，与 Spike ③ 结论同点）
> 冻结原则：**必填字段只增不改语义；枚举值只增不改值义；消费端必须容忍未知枚举值**（否则拒绝发布与向前兼容均不成立）。

---

## 1. 事件信封总结构

每个入总线的领域事件一律使用统一信封，载荷置 `body`：

```jsonc
{
  "event_id": "ulid",                 // 全局唯一，幂等消费键
  "event_type": "TASK_COMPLETED",     // §3 域事件类型清单
  "schema_version": 1,                // 冻结后 = 1，演进走新版本
  "occurred_at": "RFC3339",           // 墙钟时间（展示用；一切业务计时以 xun_no 为准）
  "season_no": 3,                     // 赛季号 【ADR-002】
  "xun_no": 14,                       // 旬号——全系统确定性版本轴 【ADR-002 / ARCH-002】
  "nation_id": "han",                 // 分区键（按国家有序消费）【ADR-002】
  "body": { "...": "领域载荷，按 event_type 各自定义（本次冻结类型名，不冻结载荷字段全量）" },

  "trace": {                          // 因果链字段——归因/复盘/史书的唯一凭据
    "proposal_id": "prop_han_x13_007 | null",   // 方略提案 【ARCH-002 / S2 §4.3】
    "decree_id":   "han_x14_edict   | null",    // 诏令（旬号内含）【ARCH-002】
    "ref_goal_id": "goal_...        | null",    // 诏令目标实例（任务↔诏令目标绑定；任务完成事件必须携带归属目标）【GDD-S12 Q3 / ARCH-010】
    "task_id":     "t_99012         | null",    // 任务实例 【ARCH-002】
    "origin_action_id": "act_...      | null",  // REVOKE/OVERRIDE 的目标动作 【ARCH-005】
    "superseded_by":    "act_...      | null"   // 被覆盖动作指向新动作 【ARCH-005】
  },

  "agent_source": "HUMAN_UI",         // 必填枚举：行为来源审计 【ARCH-003 / ADR-005】
  "agent_id": "ag_771 | null",        // 玩家声明的客卿标识（可空）【ARCH-003 / S7 §4.2】
  "delegate_scope": "NONE",           // 权限代理标记 【ARCH-006/007】
  "settlement_state": "SETTLED",      // 动作/事件结算态 【ARCH-005 状态机】
  "origin": "OTHER_TASK | null",      // 收益来源标记（国力总账归因隔离用，可空）【S2 §4.5 / ARCH-002】
  "stratum": "CORE | RURAL | null",   // 事件时点玩家分层（分层聚合/风控分群输入；null=系统事件或未分层）【TASK-010 / S11 / ARCH-010】

  "extensions": { }                   // V1 扩展位（自由字段；永不作为归因/结算依据）
}
```

### 字段来源一览（17 个信封字段）

| 字段 | 来源 | 用途一句话 |
|---|---|---|
| event_id / event_type / schema_version / occurred_at / body | ADR-002 通用 | 事件基本标识 |
| season_no / xun_no | ADR-002 | 确定性版本轴：快照冻结、冷却、归因窗口、旬决策全部以旬号为锚 |
| nation_id | ADR-002 | 分区键（按国家有序消费） |
| trace.proposal_id | ARCH-002 / S2 N3 | 策功归因链起点（"采某卿之议"） |
| trace.decree_id | ARCH-002 | 诏令目标归因（策功链中段） |
| trace.ref_goal_id | GDD-S12 Q3 / ARCH-010 | 任务↔诏令目标绑定（一诏令多目标时归因落到目标粒度） |
| trace.task_id | ARCH-002 | 任务→收益→双账（策功/事功同源） |
| trace.origin_action_id | ARCH-005 | 玩家主权：REVOKE/OVERRIDE 目标 |
| trace.superseded_by | ARCH-005 | 被覆盖动作的痕迹链接（复盘不删史） |
| agent_source | ARCH-003（ADR-005） | API vs 手操行为区分（审计/农场检测/公平性分群） |
| agent_id | ARCH-003（S7 K1） | 客卿档案双 ID（player_id+agent_id） |
| delegate_scope | ARCH-006/007 | 代摄（政治身份转移）vs 守舍（个人自动化）区分 |
| settlement_state | ARCH-005 | 归因窗口与"未结算可撤销"的判据 |
| origin | S2 §4.5 / ARCH-002 | 国力总账来源隔离（策功只算直接增量） |
| stratum | TASK-010 / S11 / ARCH-010 | 事件时点玩家分层快照（分层聚合 O(君主数) 输入、公平性分群）；事件级冗余存储免回表关联 players |
| extensions | 冻结预留 | V1 扩展（不作任何结算依据） |

---

## 2. 枚举定稿表（9 组）

| 枚举 | 值集 | 来源 | 备注 |
|---|---|---|---|
| `agent_source` | HUMAN_UI / PLAYER_API / GM_TOOL | ARCH-003 | 必填；GM_TOOL 预埋（GM 注入走审计同一路径） |
| `origin`（收益来源） | AI_DOMESTIC / DECAY / EVENT / OTHER_TASK / WAR_RESULT | S2 §4.5 + S3 §7.1 | 战果申报独立于一般 EVENT（S3 战果走声明-结算-归因全流程） |
| `settlement_state`（动作终态） | SUBMITTED / VALIDATED / SETTLED / REVOKED / SUPERSEDED | ARCH-005 | REVOKED/SUPERSEDED 终态归因清零、痕迹保留 |
| `verdict`（策功判定） | MERIT / FAULT / VOID | S2 §4.4 | VOID=窗口未满或目标被事件诏令覆盖（覆盖不罚） |
| `delegate_scope` | NONE / REGENT_PROXY / OFFLINE_GUARDIAN | ARCH-007 / ARCH-006 | 代摄=政治身份转移；守舍=个人自动化；与 agent_source 正交可并存 |
| `authority`（确认矩阵） | AUTO_OK / CONFIRM / MANUAL_ONLY | ARCH-004/005 | 动作白名单数据字段，服务端强制，客户端不可改 |
| `custody_tier`（托管） | ASSIST / AUTONOMOUS | ARCH-004 | 二元化定稿；无 ONLINE_OFFLINE 枚举（离线由契约与三段判定表达） |
| 审计事件类型 `audit_action` | ACTION_SUBMITTED / ACTION_CONFIRMED / ACTION_REVOKED / ACTION_OVERRIDDEN / ACTION_EXECUTED / AUTOMATION_SUSPENDED / AUTOMATION_RESUMED / CONTRACT_HALTED / ABSENCE_STATE_CHANGED | ARCH-005/006/007 + S7 | REVOKE/OVERRIDE 即第 3/4 值；透明日志消费此枚举 |
| `stratum`（玩家分层） | CORE / RURAL | TASK-010 / S11 / ARCH-010 | 信封 `stratum` 字段值集（可空 null=系统事件/未分层）；初版两值随 S11 分层判据定稿可增（只增不改值义） |

**枚举统计：9 组 / 38 个值。**

---

## 3. 各域事件类型清单（类型名 + 一句话用途；载荷字段本次不冻结）

### 国力域（S2，6 类型）
| 类型 | 用途 |
|---|---|
| `NATION_SNAPSHOT_TAKEN` | 旬快照冻结落盘（S1 决策输入与复盘凭据） |
| `DIM_DELTA_APPLIED` | 维度增量入账（必含 origin 与 trace，双账归因源） |
| `SHORTAGE_FLAG_CHANGED` | 短板三级变化（进 S1 M2 快照） |
| `CRISIS_EVENT_RAISED` | CRITICAL 首触的危机叙事事件（S1 语录素材 + 守舍停机候选） |
| `DECAY_APPLIED` | 旬自然衰减入账（可追溯，origin=DECAY） |
| `SEASON_SETTLEMENT_SNAPSHOT` | 赛季末冻结（结局评定+跨季遗产输入） |

### 任务域（5 类型）
| 类型 | 用途 |
|---|---|
| `TASK_WAVE_DIRECTIVED` | S1 M5 任务潮需求单下发 |
| `TASK_GENERATED` | 规则引擎实例化（trace 完整，来源链标签） |
| `TASK_CLAIMED` | 接取（含 role_slot，官职校验） |
| `TASK_COMPLETED` | 完成结算（delta_events 喂策功/事功双链同源） |
| `TASK_FAILED` | 失败结算（质量系数惩罚路径） |

### 会战域（S3，6 类型）
| 类型 | 用途 |
|---|---|
| `WAR_DECLARED` | 宣战事件诏令落地（AI 独占终决产物）+ 守舍停机候选 |
| `WAR_STATE_CHANGED` | 会战状态机迁移（PEACETIME↔…↔SETTLED） |
| `ASSEMBLY_CONTRIB` | 集结期战备值贡献 |
| `NODE_PROGRESS_COMMITTED` | 节点推进度提交（乐观并发版本校验点） |
| `NODE_CAPTURED` | 节点易手 |
| `WAR_SETTLED` | 战果申报 S2 + 双账结算 + 恩怨入账触发 |

### 恩怨/记忆域（S1 M8，3 类型）
| 类型 | 用途 |
|---|---|
| `LEDGER_ENTRY_ADDED` | 恩怨入账（叛逃=硬记忆/怨=软记忆，附 mem_tier） |
| `LEDGER_STATE_CHANGED` | 衰减/缓和/淡忘/释怨状态机迁移 |
| `MEMORY_DIGEST_GENERATED` | 旬度软记忆摘要产出（双审凭据） |

### 外交域（2 类型 + V1 扩展）
| 类型 | 用途 |
|---|---|
| `DIPLO_EVENT_PUSHED` | 外交事件推送（进 S1 快照）——**veracity（情报可信度）为 V1 扩展位** |
| `INTERCESSION_RESOLVED` | 斡旋结果（V1 首季内测启用；MVP 斡旋卡仅"劝退"最小版） |

### 客卿域（S7/ARCH-003~006，6 类型）
| 类型 | 用途 |
|---|---|
| `AGENT_BOUND` / `AGENT_UNBOUND` | 客卿绑定/解绑（agent_id 生命周期起点） |
| `CONTEXT_PACKAGE_PUSHED` | 上下文包推送（input_digest，信息平等审计凭据） |
| `PLAYER_ACTION_SUBMITTED` | PLAYER_API 动作提交（走白名单校验） |
| `CONTRACT_SET` / `CONTRACT_HALTED` | 守舍契约生效/停机（额度熔断与事件停机共同出口） |
| `AUTOMATION_SUSPENDED` / `AUTOMATION_RESUMED` | 挂起/恢复（在线抢断、心跳冻结、停机三来源共用） |

### 摄政与官职域（ARCH-002/007 + S1 M6，7 类型）
| 类型 | 用途 |
|---|---|
| `SEAT_ASSIGNED` / `SEAT_RELEASED` | 席位任命/免职（Outbox 发布，B2 权重快照+A2 权限双消费） |
| `RANK_PROMOTED` | 散阶晋升 |
| `ROAD_SWITCHED` | 转路（降档记录，冷却注册表写入） |
| `PROFICIENCY_UNLOCKED` | 任官实践解锁（带在任证据链） |
| `REGENT_PROPOSAL_SUBMITTED` / `AI_STANCE_ISSUED` | 摄政提案与 AI 立场（威望裁定输入） |
| `ABSENCE_STATE_CHANGED` | 离席状态机迁移（告假/代摄/失期/收回/回归交割）【ARCH-007】 |

**事件类型统计：8 域 / 35 类型。**

---

## 4. 冻结范围声明

**本次冻结（v1）**：
1. 信封全部 17 个字段**名称、语义、必填性**（trace 六字段全必填结构、可空值）；
2. §2 全部 9 组枚举的值集（stratum 初版值集 CORE/RURAL，值集可增）；
3. §3 全部 35 个事件**类型名**（载荷字段按域另行冻结，不阻塞总线接入）。

**明确留 V1 扩展位（本次不冻结）**：
- `extensions` 自由字段（永不作归因/结算依据）；
- 外交 `veracity`（情报可信度，S6 落地时启用）；
- 文化/外交维度相关载荷字段（MVP 置空保留，V1 平滑启用——对齐 S2 §7.1）；
- 历史引力 `gravity_ctx`（S1 MVP 置空）、君主-摄政信任动态、复国线事件、客卿对抗玩法事件（S7 Q4 远期专项）；
- 各域事件载荷的完整字段 schema（按域冻结，建议随各域 Story 验收逐域冻结）。

**演进规则（与冻结同时生效）**：①必填字段只增不改语义，新增必填字段须升 schema_version 并给消费端一个旬的兼容窗口；②枚举只增不改值义，**消费端必须容忍未知枚举值**（拒绝未知值即违规实现）；③trace 字段语义永久固定；④任何 schema 变更走 ADR 补记。

---

## 5. 冻结检查单（与 Spike ③④ 断言对照）

| # | 检查项 | 依赖断言（Spike） | 状态 |
|---|---|---|---|
| 1 | 缺 trace 必填字段的事件被拒绝发布 | Spike ③ DoD-1 | 预览稿覆盖 ✔ |
| 2 | 全链 ID 透传无断点（提案→诏令→任务→归因） | Spike ③ DoD-2 | trace 六字段（含 ref_goal_id，ARCH-010）✔ |
| 3 | 双轨账本同源不出叉（delta_event 喂两链） | Spike ③ DoD-3 | trace.task_id + origin ✔ |
| 4 | Outbox 至少一次送达 + 幂等消费 | Spike ③ DoD-5 | event_id 幂等键 ✔ |
| 5 | 归因窗口与 source 隔离（S2 §4.5 六条） | Spike ③ DoD-4 | origin + settlement_state + verdict ✔ |
| 6 | HUMAN_UI/PLAYER_API 双路径 agent_source 正确落透明日志 | Spike ④ DoD-6 | agent_source/agent_id ✔ |
| 7 | REVOKE/OVERRIDE 审计含 superseded_by 落日志 | Spike ④ DoD-9 | origin_action_id/superseded_by + audit_action ✔ |
| 8 | 守舍 digest 与透明日志流水一致性 | Spike ④ DoD-10 | delegate_scope=OFFLINE_GUARDIAN + audit_action ✔ |
| 9 | 代摄行为审计与守舍可区分 | §2.9.4（ARCH-007） | delegate_scope=REGENT_PROXY ✔ |
| 10 | 消费端容忍未知枚举值（向前兼容） | 演进规则断言（Spike ④ 补） | 演进规则 ✔——**Spike ④ DoD 需补一条未知枚举容忍断言** |
| 11 | ABSENCE_STATE_CHANGED 全状态迁移留痕 | §2.9.1（ARCH-007） | audit_action + §3 事件类型 ✔ |
| 12 | ref_goal_id 全链透传与唯一性（任务↔诏令目标绑定） | Spike ③ DoD-4（已含 ref_goal_id 唯一性约束断言，trace 增补后信封有承载位）【GDD-S12 Q3 / ARCH-010】 | trace.ref_goal_id ✔ |
| 13 | stratum 随事件落账，分层聚合免回表（核心/乡野分桶统计可独立于 players 表完成） | §9.4（solo 文档，分层聚合 ≤2K token 硬上限）+ TASK-010【ARCH-010】 | stratum 字段位 + 枚举 ✔ |

---

## 6. 建议冻结时点与流程

1. **明早**：主理人过目本预览稿，反馈修正（预计改动集中在枚举增删与事件类型增补）；
2. **Sprint 1 末**：修正版回签（本文件状态改"已确认"），Spike ③ 按此实现校验器；
3. **Sprint 2 末**：随 Spike ③ 结论**正式冻结**（schema_version=1 定版），此后变更走 ADR；
4. 冻结前依赖确认：§5-8~18 各策划侧定稿项**不阻塞**本次冻结（均为值类参数，非结构字段——这正是 trace/枚举/类型名先冻结的价值所在）。
