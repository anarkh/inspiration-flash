# Output Contract

Default local outputs:

- `douyin_video_links.json`: canonical extraction record.
- `douyin_video_links.csv`: importable table.
- Optional `.xlsx`: generated from CSV/JSON with the Spreadsheets skill.
- Optional Feishu sheet: imported from `.xlsx` with `lark-cli drive +import --type sheet`.

## Link Table Workbook

1. `视频分享链接`
   - 序号
   - 发布时间
   - 视频ID as text, or omit if Excel shows scientific notation
   - 标题/文案
   - 分享链接
   - 作者
   - 来源主页

2. `抓取说明`
   - 博主名
   - 主页 URL
   - 提取时间
   - 视频数量
   - 分页数量
   - 最后一页 `has_more`
   - 是否完整

## Distillation Workbook

Use this when the goal is to distill a creator into a skill.

Recommended sheet name: `视频链接与文案`

Required columns:

- A `序号`
- B `发布时间`
- C `标题/列表摘要`
- D `分享链接`
- E `视频文案`
- F `视频ID`
- G `作者`
- H `来源主页`
- I `文案状态`
- J `备注`

Column rules:

- D is the canonical video link column.
- E is the canonical transcript/copy backfill column.
- I can contain `待处理`, `完成`, `失败`, or `跳过`.
- Preserve row order as newest to oldest.
- Do not generate the final distilled skill until every row with D has a non-empty E, unless the user explicitly accepts partial coverage.

Recommended second sheet: `蒸馏说明`

- 博主名
- 主页 URL
- 提取时间
- 请求视频数
- 实际视频数
- 分页数量
- 最后一页 `has_more`
- 是否因为 `--max-items` 停止
- 文案完成数
- 文案失败数
- 生成 skill 路径

Completion language:

- Complete: “已抓到最后一页，`has_more=0`。”
- Partial: “未确认到最后一页，当前表格是部分结果。”
- Recent-video limit: “已按最近 N 条停止，未继续抓取更早视频。”
- Distillation complete: “D 列视频链接均已处理，E 列文案已填满并清理尾部建议句。”
