import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const workbook = Workbook.create();
const sheet = workbook.worksheets.add("薪资职级参考表");
const detail = workbook.worksheets.add("结构化数据");

const BLACK = "#111111";
const WHITE = "#FFFFFF";
const RED = "#E3262E";
const GRAY = "#D9D9D9";
const PEACH = "#FCE4D6";
const BLUE = "#D9E2F3";
const CYAN = "#00AFC7";
const LIGHT = "#F4F6F8";
const PYRAMID = "#E2F0D9";

sheet.showGridLines = false;
sheet.freezePanes.freezeRows(2);
sheet.freezePanes.freezeColumns(2);

sheet.getRange("A1:P1").merge();
sheet.getRange("A1").values = [["互联网大厂薪资 & 职级参考表"]];
sheet.getRange("A1:P1").format = {
  fill: WHITE,
  font: { name: "PingFang SC", size: 24, bold: true, color: BLACK },
  horizontalAlignment: "center",
  verticalAlignment: "center",
  borders: { bottom: { style: "thick", color: BLACK } },
};
sheet.getRange("A1:P1").format.rowHeight = 44;

sheet.getRange("A2:A4").merge();
sheet.getRange("A2").values = [["薪资"]];
sheet.getRange("B2").values = [["总包\n（万）"]];
sheet.getRange("B3").values = [["月薪\n（开发）"]];
sheet.getRange("B4").values = [["月薪\n（运营）"]];

const salaryBands = ["10~30", "20~50", "30~60", "40~80", "60~120", "90~160", "120~240"];
const productSalary = ["10~20K", "15~30K", "20~40K", "30~50K", "40~80K", "60~100K", "80~150K"];
const operationSalary = ["8~20K", "10~25K", "15~30K", "25~40K", "35~50K", "55~80K", "80~150K"];
for (let i = 0; i < 7; i += 1) {
  const start = 2 + i * 2;
  const range = sheet.getRangeByIndexes(1, start, 1, 2);
  range.merge();
  range.values = [[salaryBands[i]]];
  const product = sheet.getRangeByIndexes(2, start, 1, 2);
  product.merge();
  product.values = [[productSalary[i]]];
  const operation = sheet.getRangeByIndexes(3, start, 1, 2);
  operation.merge();
  operation.values = [[operationSalary[i]]];
}
sheet.getRange("A2:P4").format = {
  fill: GRAY,
  font: { name: "PingFang SC", size: 12, color: BLACK },
  horizontalAlignment: "center",
  verticalAlignment: "center",
  wrapText: true,
  borders: { preset: "all", style: "thin", color: WHITE },
};
sheet.getRange("A2:A4").format.font = { name: "PingFang SC", size: 14, bold: true, color: BLACK };
sheet.getRange("B2:B4").format.font = { name: "PingFang SC", size: 12, bold: true, color: BLACK };
for (const cell of ["I2", "I3", "I4"]) {
  sheet.getRange(cell).format.font = { name: "PingFang SC", size: 12, bold: true, color: RED };
}
sheet.getRange("A4:P4").format.borders = {
  bottom: { style: "thick", color: BLACK },
  insideHorizontal: { style: "thin", color: WHITE },
  insideVertical: { style: "thin", color: WHITE },
};

sheet.getRange("A5:A14").merge();
sheet.getRange("A5").values = [["职级"]];

const levelRows = [
  { row: 5, company: "金字塔名称", fill: PYRAMID, items: [["C:E", "6级"], ["F:J", "5级"], ["K:P", "4级"]] },
  { row: 6, company: "腾讯", fill: PEACH, items: [["C:D", "5级"], ["E", "6级"], ["F", "7级"], ["G:H", "8级"], ["I:J", "9级", true], ["K:L", "10级"], ["M:N", "11级"], ["O:P", "12级"]] },
  { row: 7, company: "阿里", fill: BLUE, items: [["C:E", "P4"], ["F", "P5"], ["G:H", "P6"], ["I:L", "P7", true], ["M", "P8"], ["N:P", "P9/10"]] },
  { row: 8, company: "字节", fill: PEACH, items: [["C:D", "1-1"], ["E:F", "1-2"], ["G:H", "2-1"], ["I:J", "2-2", true], ["K:L", "3-1"], ["M:N", "3-2"], ["O:P", "4-1/2"]] },
  { row: 9, company: "快手", fill: BLUE, items: [["C:D", "k1A/B"], ["E", "K2A"], ["F", "K2B"], ["G:H", "K3A"], ["I:J", "K3B/C", true], ["K:L", "K4A"], ["M:P", "K4B"]] },
  { row: 10, company: "美团", fill: PEACH, items: [["C:D", "L3"], ["E", "L4"], ["F", "L5"], ["G:H", "L6/7"], ["I:L", "L8", true], ["M:P", "L9"]] },
  { row: 11, company: "滴滴", fill: BLUE, items: [["C:D", "D4"], ["E", "D5"], ["F", "D6"], ["G:H", "D7"], ["I:J", "D8", true], ["K:M", "D9"], ["N:P", "D10"]] },
  { row: 12, company: "京东", fill: PEACH, items: [["C:D", "P3"], ["E", "P4"], ["F", "P5"], ["G:H", "P6"], ["I:J", "P7", true], ["K:M", "P8"], ["N", "P9"], ["O:P", "P10"]] },
  { row: 13, company: "B站", fill: BLUE, items: [["C:F", "1-1/2"], ["G:H", "2-1/2"], ["I:J", "3-1", true], ["K:L", "3-2"], ["M:O", "3-3/4-1"], ["P", "-"]] },
  { row: 14, company: "小红书", fill: PEACH, items: [["C:D", "R1"], ["E", "R2"], ["F", "R3"], ["G:H", "R4"], ["I:J", "R5", true], ["K:L", "R6"], ["M", "R7/R8"], ["N", "R9"], ["O:P", "-"]] },
];

for (const entry of levelRows) {
  sheet.getRange(`B${entry.row}`).values = [[entry.company]];
  sheet.getRange(`B${entry.row}:P${entry.row}`).format = {
    fill: entry.fill,
    font: { name: "PingFang SC", size: 12, color: BLACK },
    horizontalAlignment: "center",
    verticalAlignment: "center",
    borders: { preset: "all", style: "thin", color: WHITE },
  };
  for (const [span, label, highlight] of entry.items) {
    const target = sheet.getRange(`${span.split(":")[0]}${entry.row}${span.includes(":") ? `:${span.split(":")[1]}${entry.row}` : ""}`);
    if (span.includes(":")) target.merge();
    target.values = [[label]];
    if (highlight) target.format.font = { name: "PingFang SC", size: 12, bold: true, color: RED };
  }
}
sheet.getRange("B5:P5").format.font = { name: "PingFang SC", size: 12, bold: true, color: "#375623" };
sheet.getRange("A5:A14").format = {
  fill: WHITE,
  font: { name: "PingFang SC", size: 14, bold: true, color: BLACK },
  horizontalAlignment: "center",
  verticalAlignment: "center",
  borders: { right: { style: "thick", color: BLACK }, bottom: { style: "thick", color: BLACK } },
};
sheet.getRange("B14:P14").format.borders = {
  bottom: { style: "thick", color: BLACK },
  insideVertical: { style: "thin", color: WHITE },
};

sheet.getRange("A15:B15").merge();
sheet.getRange("A15").values = [["晋升周期"]];
const promotion = ["毕业", "1~2", "2~3", "3~5", "5~7", "7~10", "9+"];
for (let i = 0; i < 7; i += 1) {
  const start = 2 + i * 2;
  const range = sheet.getRangeByIndexes(14, start, 1, 2);
  range.merge();
  range.values = [[promotion[i]]];
}
sheet.getRange("A15:P15").format = {
  fill: GRAY,
  font: { name: "PingFang SC", size: 12, color: BLACK },
  horizontalAlignment: "center",
  verticalAlignment: "center",
  borders: { top: { style: "thick", color: BLACK }, bottom: { style: "thick", color: BLACK }, insideVertical: { style: "thin", color: WHITE } },
};
sheet.getRange("I15").format.font = { name: "PingFang SC", size: 12, bold: true, color: RED };

sheet.getRange("A17:P17").merge();
sheet.getRange("A17").values = [["说明"]];
sheet.getRange("A18:P18").merge();
sheet.getRange("A18").values = [["1. 以上薪资 / 职级仅供参考，与具体岗位职责、在岗时间、年终奖、股票等有较大关系。"]];
sheet.getRange("A19:P19").merge();
sheet.getRange("A19").values = [["2. 金字塔名称采用吴军工程师五级理论；其中 6级为便于对照而向下外推。公司职级映射为经验参考，不代表官方标准。"]];
sheet.getRange("A20:P20").merge();
sheet.getRange("A20").values = [["3. 以上晋升周期表示能在该时间周期里晋升，差不多是最快时间；大部分人的瓶颈在红色字体区间，所以毕业后 5 年左右通常会出现明显分水岭。"]];
sheet.getRange("A17:P20").format = {
  fill: WHITE,
  font: { name: "PingFang SC", size: 10, color: BLACK },
  horizontalAlignment: "left",
  verticalAlignment: "center",
  wrapText: true,
};
sheet.getRange("A17").format.font = { name: "PingFang SC", size: 12, bold: true, color: BLACK };

sheet.getRange("A1:P20").format.font = { name: "PingFang SC" };
sheet.getRange("A:A").format.columnWidth = 7;
sheet.getRange("B:B").format.columnWidth = 12;
sheet.getRange("C:P").format.columnWidth = 6.5;
sheet.getRange("2:15").format.rowHeight = 34;
sheet.getRange("17:17").format.rowHeight = 24;
sheet.getRange("18:20").format.rowHeight = 28;

detail.showGridLines = false;
detail.freezePanes.freezeRows(2);
detail.getRange("A1:J1").merge();
detail.getRange("A1").values = [["互联网大厂薪资 & 职级结构化数据"]];
detail.getRange("A1:J1").format = {
  fill: BLACK,
  font: { name: "PingFang SC", size: 18, bold: true, color: WHITE },
  horizontalAlignment: "left",
  verticalAlignment: "center",
};
detail.getRange("A1:J1").format.rowHeight = 38;

detail.getRange("A3:H6").values = [
  ["薪资类型", ...salaryBands],
  ["总包（万）", ...salaryBands],
  ["月薪（开发）", ...productSalary],
  ["月薪（运营）", ...operationSalary],
];
detail.getRange("A3:H3").format = { fill: BLACK, font: { name: "PingFang SC", bold: true, color: WHITE }, horizontalAlignment: "center" };
detail.getRange("A4:H6").format = { fill: LIGHT, font: { name: "PingFang SC", color: BLACK }, horizontalAlignment: "center", borders: { preset: "all", style: "thin", color: "#D0D5DD" } };
detail.getRange("E3:E6").format.font = { name: "PingFang SC", bold: true, color: RED };

const sequences = [
  ["腾讯", "5级", "6级", "7级", "8级", "9级", "10级", "11级", "12级", "9级"],
  ["阿里", "P4", "P5", "P6", "P7", "P8", "P9/10", "", "", "P7"],
  ["字节", "1-1", "1-2", "2-1", "2-2", "3-1", "3-2", "4-1/2", "", "2-2"],
  ["快手", "k1A/B", "K2A", "K2B", "K3A", "K3B/C", "K4A", "K4B", "", "K3B/C"],
  ["美团", "L3", "L4", "L5", "L6/7", "L8", "L9", "", "", "L8"],
  ["滴滴", "D4", "D5", "D6", "D7", "D8", "D9", "D10", "", "D8"],
  ["京东", "P3", "P4", "P5", "P6", "P7", "P8", "P9", "P10", "P7"],
  ["B站", "1-1/2", "2-1/2", "3-1", "3-2", "3-3/4-1", "-", "", "", "3-1"],
  ["小红书", "R1", "R2", "R3", "R4", "R5", "R6", "R7/R8", "R9", "R5"],
];
detail.getRange("A8:J8").values = [["公司", "职级 1", "职级 2", "职级 3", "职级 4", "职级 5", "职级 6", "职级 7", "职级 8", "原图红字 / 瓶颈"]];
detail.getRange("A9:J17").values = sequences;
detail.getRange("A8:J8").format = { fill: BLACK, font: { name: "PingFang SC", bold: true, color: WHITE }, horizontalAlignment: "center", wrapText: true };
detail.getRange("A9:J17").format = { font: { name: "PingFang SC", color: BLACK }, horizontalAlignment: "center", borders: { preset: "all", style: "thin", color: "#D0D5DD" } };
for (let r = 9; r <= 17; r += 1) {
  detail.getRange(`A${r}:J${r}`).format.fill = r % 2 ? WHITE : LIGHT;
  detail.getRange(`J${r}`).format.font = { name: "PingFang SC", bold: true, color: RED };
}

detail.getRange("A19:E22").values = [
  ["金字塔等级", "能力定义", "腾讯对应", "阿里对应", "备注"],
  ["6级", "尚未形成独立工程闭环", "5-6级", "", "由五级理论向下外推"],
  ["5级", "能够独立解决工程问题", "7-9级", "P5-P7", ""],
  ["4级", "能带领其他工程师完成重要工作", "10-12级", "", ""],
];
detail.getRange("A19:E19").format = { fill: "#375623", font: { name: "PingFang SC", bold: true, color: WHITE }, horizontalAlignment: "center" };
detail.getRange("A20:E22").format = { fill: PYRAMID, font: { name: "PingFang SC", color: BLACK }, horizontalAlignment: "center", verticalAlignment: "center", wrapText: true, borders: { preset: "all", style: "thin", color: "#B7C9A8" } };
detail.getRange("A20:A22").format.font = { name: "PingFang SC", bold: true, color: "#375623" };

detail.getRange("A24:H25").values = [
  ["薪资档位", ...salaryBands],
  ["晋升周期", ...promotion],
];
detail.getRange("A24:H24").format = { fill: BLACK, font: { name: "PingFang SC", bold: true, color: WHITE }, horizontalAlignment: "center" };
detail.getRange("A25:H25").format = { fill: LIGHT, font: { name: "PingFang SC", color: BLACK }, horizontalAlignment: "center", borders: { preset: "all", style: "thin", color: "#D0D5DD" } };
detail.getRange("E25").format.font = { name: "PingFang SC", bold: true, color: RED };
detail.getRange("A27:J27").merge();
detail.getRange("A27").values = [["注：原图为经验参考，薪资、职级和晋升周期会因岗位、绩效、年终奖、股票等因素变化；红字区间表示原图强调的常见瓶颈。金字塔映射为经验对标，不是公司官方标准。"]];
detail.getRange("A27:J27").format = { fill: "#E8F8FB", font: { name: "PingFang SC", size: 10, color: CYAN }, wrapText: true, verticalAlignment: "center" };
detail.getRange("A27:J27").format.rowHeight = 36;

detail.getRange("A:A").format.columnWidth = 15;
detail.getRange("B:B").format.columnWidth = 22;
detail.getRange("C:I").format.columnWidth = 12;
detail.getRange("J:J").format.columnWidth = 18;
detail.getRange("3:25").format.rowHeight = 24;
detail.getRange("20:22").format.rowHeight = 32;

const inspect = await workbook.inspect({
  kind: "table",
  range: "薪资职级参考表!A1:P20",
  include: "values,formulas",
  tableMaxRows: 20,
  tableMaxCols: 16,
  maxChars: 9000,
});
console.log(inspect.ndjson);

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 100 },
  summary: "final formula error scan",
});
console.log(errors.ndjson);

const preview1 = await workbook.render({ sheetName: "薪资职级参考表", range: "A1:P20", scale: 1.5, format: "png" });
const preview2 = await workbook.render({ sheetName: "结构化数据", range: "A1:J27", scale: 1.5, format: "png" });
await fs.writeFile("preview-reference.png", new Uint8Array(await preview1.arrayBuffer()));
await fs.writeFile("preview-data.png", new Uint8Array(await preview2.arrayBuffer()));

const outputPath = "/Users/jarvan/workspace/work2/jarvans.com/todo/互联网大厂薪资职级参考表.xlsx";
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
console.log(`saved:${outputPath}`);
