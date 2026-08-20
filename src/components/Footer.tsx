import { memo } from "react";

export const Footer = memo(function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <span className="site-footer-brand">简历记</span>
        <span>当前免费开放</span>
      </div>
    </footer>
  );
});
