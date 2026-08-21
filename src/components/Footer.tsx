import { memo } from "react";

export const Footer = memo(function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <span className="site-footer-brand">简历记</span>
        <a className="site-footer-record" href="https://beian.mps.gov.cn/#/query/webSearch?code=51070302110762" rel="noreferrer" target="_blank">
          <img src="/备案图标.png" alt="" aria-hidden="true" />
          <span>川公网安备51070302110762号</span>
        </a>
      </div>
    </footer>
  );
});
