# 世界地理数据集（world-geo.json）使用说明

> 2026-11-02 由主理人团队整理。来源与用途见 JSON 内 `_meta`。

## 是什么

`game/data/world-geo.json` 是《列国策》的**真实地理数据集**，基于史实经纬度编译：

- **23 座城邑**：七国都城（含史实坐标）+ 大城/关隘/边郡（函谷关、成皋、长平、井陉关、宜阳铁山之城、定陶商埠等）；
- **7 条路线**：函谷道、武关道、金牛道、太行走廊、鸿沟水运等——日后"行军/商路/刺探"系统的路线骨架；
- **10 处资源区**：河东盐池、齐地渔盐、宜阳/邯郸冶铁、铜绿山铜矿、关中/蜀地/江汉粮仓等——日后"资源产地/争夺战"系统的数据底座。

## 定位规则

每个条目都有两层坐标：

1. `lat/lng` —— 现代经纬度（史实定位，永远正确）；
2. `map` —— 当前游戏内水墨舆图的百分比锚点，线性换算：

```
x% = 22 + (lng − 108.71) × 4.9
y% = 48 − (lat − 34.33) × 6.1
```

误差约 ±4%（舆图为艺术化示意图）。**接入方式**：城池/路线/资源功能上线时，按此公式把数据点铺到舆图上即可，无需重绘底图。

## 舆图底图来源（待换装）

当前游戏内的"天下舆图"底图是 AI 绘制的水墨示意图（布局按史实方位）。**已锁定的正式替换来源**：

- [Warring States c. 250 BC.svg（CC0 公版）](https://commons.wikimedia.org/wiki/Special:FilePath/Warring_States_c._250_BC.svg)——基于 Natural Earth 真实自然边界 + 《剑桥中国秦汉史》Vol.1 p.39 疆域考据，94KB SVG，可无损缩放；
- 备选：[EN-WarringStatesAll260BCE.jpg（CC BY-SA 3.0，带地形着色）](https://commons.wikimedia.org/wiki/Special:FilePath/EN-WarringStatesAll260BCE.jpg)——使用需署名。

**换装步骤**（本机网络可达 Wikimedia 后执行）：下载 SVG → `sharp` 转 1280px WebP（质量 72，预算内）→ base64 内嵌替换 `WMAP_IMG` → 按 CC0 无需署名（BY-SA 备选需在舆图角落加"图源：Wikimedia Commons / CC BY-SA 3.0"）→ 以真实地图重新目测校正 7 国锚点百分比。
