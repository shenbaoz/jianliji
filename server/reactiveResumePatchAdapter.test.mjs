import assert from "node:assert/strict";
import test from "node:test";
import {
  applyReactiveResumeProposals,
  buildReactiveResumeImproveMessages,
  normalizeResumePatchProposals
} from "./vendor/reactive-resume/patch-proposal.mjs";

test("uses Reactive Resume's improvement framework and RFC 6902 proposal contract", () => {
  const messages = buildReactiveResumeImproveMessages({
    resumeText: "教育背景\n新闻学本科\n负责校园活动方案撰写、现场协同与复盘执行",
    targetRole: "内容运营",
    jobDescription: "负责内容策划"
  });
  const prompt = messages.map((message) => message.content).join("\n");

  assert.match(prompt, /只改写经历正文，不动结构/);
  assert.match(prompt, /动词开头/);
  assert.match(prompt, /量化优先/);
  assert.match(prompt, /JSON Patch/);
  assert.match(prompt, /\/lines\/行号/);
  assert.match(prompt, /严禁虚构/);
});

test("normalizes and directly applies Reactive Resume patch proposals", () => {
  const proposals = normalizeResumePatchProposals({
    proposals: [{
      title: "强化经历",
      operations: [{
        op: "replace",
        path: "/lines/2",
        value: "负责校园活动全流程执行，涵盖方案撰写、现场协同与复盘。"
      }]
    }]
  });
  const result = applyReactiveResumeProposals(
    { lines: ["教育背景", "新闻学本科", "负责校园活动方案撰写、现场协同与复盘执行"] },
    proposals
  );

  assert.equal(proposals[0].id, "proposal-1");
  assert.equal(result.lines[2], "负责校园活动全流程执行，涵盖方案撰写、现场协同与复盘。");
  assert.deepEqual(result.changes, [{
    before: "负责校园活动方案撰写、现场协同与复盘执行",
    after: "负责校园活动全流程执行，涵盖方案撰写、现场协同与复盘。"
  }]);
});

test("rejects proposals that fabricate unsupported numbers", () => {
  const proposals = normalizeResumePatchProposals({
    proposals: [{
      title: "错误量化",
      operations: [{ op: "replace", path: "/lines/2", value: "活动曝光 100000 人" }]
    }]
  });

  assert.throws(
    () => applyReactiveResumeProposals(
      { lines: ["教育背景", "新闻学本科", "负责校园活动执行"] },
      proposals
    ),
    /unsupported number/i
  );
});

test("drops unsupported ownership upgrades while keeping safe improvements", () => {
  const proposals = normalizeResumePatchProposals({
    proposals: [{
      title: "经历强化",
      operations: [
        { op: "replace", path: "/lines/1", value: "主导校园活动全流程。" },
        { op: "replace", path: "/lines/2", value: "负责校园活动执行，并完成方案撰写与现场协同。" }
      ]
    }]
  });

  const result = applyReactiveResumeProposals(
    { lines: ["经历", "参与校园活动", "负责校园活动方案撰写、现场协同与执行"] },
    proposals
  );

  assert.equal(result.lines[1], "参与校园活动");
  assert.equal(result.lines[2], "负责校园活动执行，并完成方案撰写与现场协同。");
  assert.equal(result.changes.length, 1);
});

test("preserves each source responsibility verb instead of swapping or removing it", () => {
  const proposals = normalizeResumePatchProposals({
    proposals: [{
      title: "错误责任变化",
      operations: [
        { op: "replace", path: "/lines/1", value: "参与项目需求整理并推动上线。" },
        { op: "replace", path: "/lines/2", value: "协调活动现场与资料整理。" },
        { op: "replace", path: "/lines/3", value: "负责完成用户访谈记录。" }
      ]
    }]
  });

  const result = applyReactiveResumeProposals(
    { lines: ["经历", "负责项目需求整理", "参与活动执行", "协助用户访谈"] },
    proposals
  );

  assert.deepEqual(result.lines, ["经历", "负责项目需求整理", "参与活动执行", "协助用户访谈"]);
  assert.deepEqual(result.changes, []);
});

test("fast-polish prompt forbids invented methods and preserves responsibility wording", () => {
  const prompt = buildReactiveResumeImproveMessages({ resumeText: "工作经历\n负责问题定位", targetRole: "Android 开发" })
    .map((message) => message.content)
    .join("\n");

  assert.match(prompt, /负责.*参与.*协助.*原样保留/);
  assert.match(prompt, /没有.*方法.*结果.*不得新增/);
  assert.doesNotMatch(prompt, /避免"负责""参与""协助"/);
  assert.doesNotMatch(prompt, /没有数字的，用"xx 项"/);
});

test("does not count whitespace cleanup as a substantive resume optimization", () => {
  const proposals = normalizeResumePatchProposals({
    proposals: [{
      title: "格式整理",
      operations: [{ op: "replace", path: "/lines/1", value: "负责  内容运营，输出内容 150+篇。" }]
    }]
  });

  const result = applyReactiveResumeProposals(
    { lines: ["经历", "负责内容运营，输出内容150+篇。"] },
    proposals
  );

  assert.equal(result.lines[1], "负责内容运营，输出内容150+篇。");
  assert.equal(result.changes.length, 0);
});
