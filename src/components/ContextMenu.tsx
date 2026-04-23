import { useEffect, useRef } from "react";

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onUpdateToken: () => void;
  onCopyToken: () => void;
  onBuyPro: () => void;
  onDelete: () => void;
}

export function ContextMenu({
  x,
  y,
  onClose,
  onUpdateToken,
  onCopyToken,
  onBuyPro,
  onDelete,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 调整菜单位置，防止超出屏幕
    if (menuRef.current) {
      const menu = menuRef.current;
      const rect = menu.getBoundingClientRect();

      if (rect.right > window.innerWidth) {
        menu.style.left = `${x - rect.width}px`;
      }
      if (rect.bottom > window.innerHeight) {
        menu.style.top = `${y - rect.height}px`;
      }
    }
  }, [x, y]);

  return (
    <>
      <div className="context-menu-overlay" onClick={onClose} />
      <div
        ref={menuRef}
        className="context-menu"
        style={{ left: x, top: y }}
      >
        <div className="context-menu-item" onClick={onUpdateToken}>
          <span className="icon"></span>
          更新 Token
        </div>
        <div className="context-menu-item" onClick={onCopyToken}>
          <span className="icon"></span>
          复制 Token
        </div>
        <div className="context-menu-item" onClick={onBuyPro}>
          <span className="icon"></span>
          购买 Pro
        </div>
        <div className="context-menu-divider" />
        <div className="context-menu-item danger" onClick={onDelete}>
          <span className="icon"></span>
          删除账号
        </div>
      </div>
    </>
  );
}
