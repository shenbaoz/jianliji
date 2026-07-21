import { loadVersions } from "../services/storage";

export function AdminView() {
  const versions = loadVersions();

  return (
    <section className="page-shell">
      <div className="panel">
        <h1>后台预览</h1>
        <p className="muted-text">这个页面不展示给普通顾客。正式上线需要管理员登录和权限校验。</p>
        <div className="admin-grid">
          <div>
            <span>用户数</span>
            <strong>1</strong>
          </div>
          <div>
            <span>简历版本</span>
            <strong>{versions.length}</strong>
          </div>
          <div>
            <span>订单</span>
            <strong>暂未接入支付</strong>
          </div>
          <div>
            <span>模板数</span>
            <strong>6</strong>
          </div>
        </div>
      </div>
      <div className="panel">
        <h2>运营管理范围</h2>
        <div className="admin-table">
          {["用户管理", "简历记录", "订单管理", "模板管理", "AI提示词", "价格配置", "用户反馈"].map((item) => (
            <div key={item}>
              <span>{item}</span>
              <em>后续接入真实后端</em>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
