import assert from "node:assert/strict";
import test from "node:test";
import { evaluateResumeQuality, evaluateUniversalRefinement } from "./resumeQualityGate.mjs";

test("universal quality gate accepts substantive deletion and rewriting", () => {
  const result = evaluateUniversalRefinement({
    sourceText: "自我评价：本人认真负责\n实习：负责推文撰写和发布",
    draft: "实习经历\n- 负责公众号推文撰写与发布。",
    changes: [
      { before: "自我评价：本人认真负责", after: "" },
      { before: "负责推文撰写和发布", after: "负责公众号推文撰写与发布。" }
    ]
  });

  assert.equal(result.passed, true);
});

test("universal quality gate rejects synonym-only edits", () => {
  const result = evaluateUniversalRefinement({
    sourceText: "实习经历\n负责公众号内容选题、撰写、排版和复盘，参与校园活动执行。",
    draft: "实习经历\n负责公众号内容选题、撰写、排版与复盘，参与校园活动落地。",
    changes: [{
      before: "负责公众号内容选题、撰写、排版和复盘，参与校园活动执行。",
      after: "负责公众号内容选题、撰写、排版与复盘，参与校园活动落地。"
    }]
  });

  assert.equal(result.passed, false);
  assert.ok(result.checks.some((item) => /实质改写/.test(item)));
});

test("quality gate accepts a complete evidence-bound novice resume", () => {
  const source = "求职目标：内容运营实习生\n教育：新闻学本科\n课程项目：校园公众号，负责选题、采访、排版与复盘\n技能：剪映";
  const draft = `求职目标：内容运营实习生\n核心优势\n- 具备校园内容项目实践，能够完成选题、采访与排版。\n- 能围绕项目目标整理内容并参与复盘。\n- 掌握剪映，可支持基础内容制作。\n教育背景\n新闻学本科\n项目经历\n校园公众号｜课程项目\n- 负责内容选题与采访准备，结合校园话题完成素材整理和版面编排。\n- 参与项目复盘，归纳内容执行中的协作问题并整理后续改进方向。\n技能\n剪映、内容选题、采访与排版。`;
  const result = evaluateResumeQuality({ sourceText: source, targetRole: "内容运营实习生", draft, qa: { verdict: "ready", score: 92 } });
  assert.equal(result.passed, true);
});

test("quality gate blocks fabricated metrics, tools and notes", () => {
  const result = evaluateResumeQuality({ sourceText: "课程项目：校园公众号", targetRole: "运营", draft: "求职目标：运营\n[待确认]\n使用 Python 获得 3000 用户。", qa: { verdict: "ready", score: 90 } });
  assert.equal(result.passed, false);
  assert.ok(result.reviewFlags.some((item) => /Python|3000/.test(item)));
});

test("quality gate requires core advantages and rejects generic self-evaluation", () => {
  const source = "求职目标：运营实习生\n教育：本科\n校园活动：参与通知整理和现场协调\n技能：Excel基础";
  const draft = `${source}\n自我评价\n本人性格开朗，能独立主导活动。`;
  const result = evaluateResumeQuality({ sourceText: source, targetRole: "运营实习生", draft, qa: { verdict: "ready", score: 92 } });
  assert.equal(result.passed, false);
  assert.ok(result.checks.some((item) => /核心优势/.test(item)));
  assert.ok(result.checks.some((item) => /自我评价/.test(item)));
});

test("quality gate rejects a polished-looking draft that substantially copies the source", () => {
  const source = "求职目标：内容运营\n核心优势\n负责公众号内容选题、撰写和排版，参与活动执行与复盘。\n教育经历\n新闻学本科\n技能\n公众号、小红书、剪映";
  const draft = `${source}\n补充说明：可投递内容运营岗位。`;
  const result = evaluateResumeQuality({ sourceText: source, targetRole: "内容运营", draft, qa: { verdict: "ready", score: 92 } });

  assert.equal(result.passed, false);
  assert.ok(result.checks.some((item) => /改写幅度不足/.test(item)));
});

test("quality gate allows an existing resume to keep its sections while polishing wording in place", () => {
  const source = "教育背景\n新闻学本科，学习新闻采访与写作。\n实习经历\n负责公众号内容选题、撰写、排版和复盘，参与校园活动执行，维护用户社群并整理反馈。\n项目经历\n参与品牌推广，完成活动物料整理、现场协调和数据记录。\n校园经历\n联系校外品牌方，协调校内资源，参与地推、晚会赞助和活动复盘，整理参与人员反馈。\n社群运营\n维护多个用户社群，整理日常问题和活动反馈，并根据成员需求调整沟通内容。\n技能\n使用剪映、秀米和Office完成内容制作与日常协作。";
  const draft = "教育背景\n新闻学本科，系统学习新闻采访与写作。\n实习经历\n负责公众号内容选题、撰写、排版与复盘，参与校园活动落地，维护用户社群并归纳反馈。\n项目经历\n参与品牌推广，完成活动物料整理、现场协同与数据记录。\n校园经历\n对接校外品牌方，协调校内资源，参与地推、晚会赞助与活动复盘，归纳参与人员反馈。\n社群运营\n维护多个用户社群，归纳日常问题与活动反馈，并依据成员需求优化沟通内容。\n技能\n使用剪映、秀米和Office支持内容制作与日常协作。";
  const result = evaluateResumeQuality({ sourceText: source, targetRole: "内容运营", draft, sourceMode: "resume", qa: { verdict: "ready", score: 92 } });

  assert.equal(result.passed, true);
  assert.equal(result.checks.some((item) => /核心优势|改写幅度不足|目标岗位不清晰/.test(item)), false);
});

test("quality gate rejects an existing resume when AI returns the original wording unchanged", () => {
  const source = "教育背景\n新闻学本科，学习新闻采访与写作。\n实习经历\n负责公众号内容选题、撰写、排版和复盘，参与校园活动执行，维护用户社群并整理反馈。\n项目经历\n参与品牌推广，完成活动物料整理、现场协调和数据记录。\n技能\n使用剪映、秀米和Office完成内容制作与日常协作。";
  const result = evaluateResumeQuality({ sourceText: source, targetRole: "内容运营", draft: source, sourceMode: "resume", qa: { verdict: "ready", score: 92 } });

  assert.equal(result.passed, false);
  assert.ok(result.checks.some((item) => /未产生实际文字改写/.test(item)));
});

test("quality gate rejects an existing resume that only swaps a few near-synonyms", () => {
  const source = "教育背景\n新闻学本科，学习新闻采访与写作。\n实习经历\n负责公众号内容选题、撰写、排版和复盘，参与校园活动执行，维护用户社群并整理反馈。\n项目经历\n参与品牌推广，完成活动物料整理、现场协调和数据记录。\n校园经历\n联系校外品牌方，协调校内资源，参与地推、晚会赞助和活动复盘。\n技能\n使用剪映、秀米和Office完成内容制作与日常协作。";
  const draft = "教育背景\n新闻学本科，系统学习新闻采访与写作。\n实习经历\n负责公众号内容选题、撰写、排版与复盘，参与校园活动执行，维护用户社群并整理反馈。\n项目经历\n参与品牌推广，完成活动物料整理、现场协同和数据记录。\n校园经历\n联系校外品牌方，协调校内资源，参与地推、晚会赞助和活动复盘。\n技能\n使用剪映、秀米和Office完成内容制作与日常协作。";
  const result = evaluateResumeQuality({ sourceText: source, targetRole: "内容运营", draft, sourceMode: "resume", qa: { verdict: "ready", score: 92 } });

  assert.equal(result.passed, false);
  assert.ok(result.checks.some((item) => /改写幅度不足/.test(item)));
});

test("quality gate fails a safe but nearly unchanged draft when priority evidence is not front-loaded", () => {
  const source = "教育背景\n新闻学本科\n经历\n校园推广活动执行\n公众号运营：每周产出 3-4 篇深度原创\n小红书运营：输出 150+ 篇内容";
  const strategy = {
    targetRole: "新媒体运营实习生",
    keywords: ["内容运营"],
    priorityEvidence: ["公众号运营：每周产出 3-4 篇深度原创", "小红书运营：输出 150+ 篇内容"],
    deprioritizedEvidence: ["校园推广活动执行"],
    gaps: [],
    highlights: []
  };
  const result = evaluateResumeQuality({
    sourceText: source,
    targetRole: "新媒体运营实习生",
    draft: source,
    sourceMode: "resume",
    strategy,
    qa: { verdict: "ready", score: 95 }
  });

  assert.equal(result.passed, false);
  assert.ok(result.checks.some((item) => /前置|前半部分/.test(item)));
});

test("quality gate passes a draft that front-loads the target role's priority evidence", () => {
  const source = "教育背景\n新闻学本科\n经历\n校园推广活动执行\n公众号运营：每周产出 3-4 篇深度原创\n小红书运营：输出 150+ 篇内容";
  const strategy = {
    targetRole: "新媒体运营实习生",
    keywords: ["内容运营"],
    priorityEvidence: ["公众号运营：每周产出 3-4 篇深度原创", "小红书运营：输出 150+ 篇内容"],
    deprioritizedEvidence: ["校园推广活动执行"],
    gaps: [],
    highlights: ["前置小红书与公众号的内容运营证据"]
  };
  const draft = "核心优势\n- 小红书内容运营：日更原创，累计输出求职攻略 150+ 篇内容。\n- 公众号运营：每周产出 3-4 篇深度原创内容。\n教育背景\n新闻学本科\n经历\n- 校园推广活动执行";
  const result = evaluateResumeQuality({
    sourceText: source,
    targetRole: "新媒体运营实习生",
    draft,
    sourceMode: "resume",
    strategy,
    qa: { verdict: "ready", score: 90 }
  });

  assert.equal(result.passed, true);
  assert.deepEqual(result.highlights, ["前置小红书与公众号的内容运营证据"]);
});
