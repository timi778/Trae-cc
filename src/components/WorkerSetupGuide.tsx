import { useState } from 'react';

interface WorkerSetupGuideProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WorkerSetupGuide({ isOpen, onClose }: WorkerSetupGuideProps) {
  const [copied, setCopied] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [sqlCopied, setSqlCopied] = useState(false);
  const [showSql, setShowSql] = useState(true);

  if (!isOpen) return null;

  const workerCode = `export default {
  async fetch(request, env) {
    // 1. 设置跨域头
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    // 初始化数据库表
    await env.DB.prepare(\`CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, address TEXT, source TEXT, subject TEXT, content TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)\`).run();
    
    // 自动清理超过1分钟的数据
    await env.DB.prepare(\`DELETE FROM messages WHERE created_at < datetime('now', '-1 minute')\`).run();

    // 接口逻辑
    if (url.pathname === "/api/get-code") {
      
      const providedKey = url.searchParams.get("key");
      if (providedKey !== env.SECRET_KEY) {
        return new Response(JSON.stringify({ error: "密钥错误" }), {
          status: 403,
          headers: { "Content-Type": "application/json;charset=UTF-8", ...corsHeaders }
        });
      }

      const targetEmail = url.searchParams.get("email");
      if (!targetEmail) {
        return new Response(JSON.stringify({ error: "缺少 email 参数" }), {
          status: 400,
          headers: { "Content-Type": "application/json;charset=UTF-8", ...corsHeaders }
        });
      }

      // --- 【重点修改部分开始】 ---
      // 不再在 SQL 里使用 REGEXP，而是取出该邮箱最近的 5 封邮件，在 JS 里匹配
      const query = "SELECT content, datetime(created_at, '+8 hours') as local_time FROM messages WHERE address = ? ORDER BY id DESC LIMIT 5";
      const { results } = await env.DB.prepare(query).bind(targetEmail.toLowerCase().trim()).all();
      
      let finalResult = null;
      let finalCode = null;
      const codeRegex = /\\b\\d{6}\\b/; // 匹配 6 位数字的正则

      if (results && results.length > 0) {
        // 遍历最近的邮件，寻找第一封包含 6 位验证码的邮件
        for (const row of results) {
          const match = row.content.match(codeRegex);
          if (match) {
            finalResult = row;
            finalCode = match[0];
            break; // 找到了最新的验证码，跳出循环
          }
        }
      }

      if (!finalResult) {
        return new Response(JSON.stringify({ error: "未找到包含验证码的邮件，或已过期" }), {
          status: 404,
          headers: { "Content-Type": "application/json;charset=UTF-8", ...corsHeaders }
        });
      }
      
      // 4. 返回 JSON
      return new Response(JSON.stringify({
        email: targetEmail,
        code: finalCode,
        time: \${finalResult.local_time} (北京时间)\
      }), {
        status: 200,
        headers: { "Content-Type": "application/json;charset=UTF-8", ...corsHeaders }
      });
      // --- 【重点修改部分结束】 ---
    }

    return new Response("接口运行中", { headers: corsHeaders });
  },

  async email(message, env) {
    await env.DB.prepare(\`DELETE FROM messages WHERE created_at < datetime('now', '-1 minute')\`).run();

    const raw = await new Response(message.raw).text();
    const subject = message.headers.get("subject") || "";
    
    // 只要是常见的验证码邮件关键词就存入
    const isVerificationEmail =
      subject.toLowerCase().includes('verification') ||
      subject.toLowerCase().includes('验证码') ||
      subject.toLowerCase().includes('code') ||
      raw.includes('Verification Code');
    
    if (!isVerificationEmail) return;
    
    // 提取验证码存入 content 字段
    let extractedCode = null;
    const htmlCodeMatch = raw.match(/>(\\d{6})</);
    if (htmlCodeMatch) {
      extractedCode = htmlCodeMatch[1];
    } else {
      const bodyCodeMatch = raw.match(/\\b\\d{6}\\b/);
      if (bodyCodeMatch) extractedCode = bodyCodeMatch[0];
    }
    
    if (!extractedCode) return;
    
    // 清洗正文
    let body = raw.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/=\\r?\\n/g, '').trim();
    body = extractedCode + ' ' + body; // 确保验证码在正文开头

    const toAddress = ( message.to  || "").toLowerCase().trim();

    try {
      await env.DB.prepare(
        "INSERT INTO messages (address, source, subject, content) VALUES (?, ?, ?, ?)"
      ).bind(toAddress, message.from, subject, body).run();
    } catch (e) {
      console.error("存入失败:", e.message);
    }
  }
};`;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(workerCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const styles: Record<string, React.CSSProperties> = {
    overlay: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px',
    },
    modal: {
      backgroundColor: '#fff',
      borderRadius: '16px',
      width: '100%',
      maxWidth: '900px',
      maxHeight: '85vh',
      display: 'flex',
      flexDirection: 'column',
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      overflow: 'hidden',
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '24px 28px',
      borderBottom: '1px solid #e5e7eb',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    },
    title: {
      fontSize: '22px',
      fontWeight: 700,
      color: '#fff',
      margin: 0,
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
    },
    closeBtn: {
      background: 'rgba(255,255,255,0.2)',
      border: 'none',
      width: '36px',
      height: '36px',
      borderRadius: '50%',
      cursor: 'pointer',
      fontSize: '24px',
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'all 0.2s',
    },
    content: {
      padding: '28px',
      overflowY: 'auto',
      flex: 1,
      backgroundColor: '#f9fafb',
    },
    section: {
      marginBottom: '32px',
      backgroundColor: '#fff',
      borderRadius: '12px',
      padding: '24px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    },
    sectionTitle: {
      fontSize: '18px',
      fontWeight: 700,
      color: '#1f2937',
      marginBottom: '16px',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
    },
    sectionDesc: {
      fontSize: '15px',
      color: '#6b7280',
      lineHeight: 1.7,
      marginBottom: '20px',
    },
    phase: {
      marginBottom: '28px',
    },
    phaseTitle: {
      fontSize: '16px',
      fontWeight: 600,
      color: '#374151',
      marginBottom: '12px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    },
    phaseNumber: {
      width: '28px',
      height: '28px',
      borderRadius: '50%',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '14px',
      fontWeight: 700,
    },
    ol: {
      margin: '0 0 0 20px',
      padding: 0,
      color: '#4b5563',
      fontSize: '14px',
      lineHeight: 2,
    },
    li: {
      marginBottom: '8px',
    },
    code: {
      backgroundColor: '#f3f4f6',
      padding: '2px 8px',
      borderRadius: '4px',
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#dc2626',
    },
    codeBlock: {
      backgroundColor: '#1f2937',
      color: '#e5e7eb',
      padding: '16px',
      borderRadius: '8px',
      overflow: 'auto',
      fontSize: '12px',
      lineHeight: 1.5,
      marginTop: '12px',
      maxHeight: '300px',
    },
    expandButton: {
      backgroundColor: '#f3f4f6',
      border: '1px solid #e5e7eb',
      padding: '10px 16px',
      borderRadius: '8px',
      fontSize: '14px',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      marginTop: '12px',
      color: '#374151',
    },
    copyButton: {
      position: 'absolute',
      top: '12px',
      right: '12px',
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      color: '#e5e7eb',
      padding: '8px 16px',
      borderRadius: '6px',
      fontSize: '13px',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      transition: 'all 0.2s',
      zIndex: 10,
    },
    copyButtonCopied: {
      backgroundColor: 'rgba(34, 197, 94, 0.2)',
      borderColor: 'rgba(34, 197, 94, 0.4)',
      color: '#22c55e',
    },
    note: {
      backgroundColor: '#fef3c7',
      borderLeft: '4px solid #f59e0b',
      padding: '16px 20px',
      borderRadius: '8px',
      marginTop: '20px',
      fontSize: '14px',
      color: '#92400e',
    },
    important: {
      backgroundColor: '#fee2e2',
      borderLeft: '4px solid #dc2626',
      padding: '12px 16px',
      borderRadius: '8px',
      marginTop: '12px',
      fontSize: '14px',
      color: '#991b1b',
    },
    actions: {
      padding: '20px 28px',
      borderTop: '1px solid #e5e7eb',
      backgroundColor: '#fff',
      display: 'flex',
      justifyContent: 'flex-end',
    },
    button: {
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: '#fff',
      border: 'none',
      padding: '12px 32px',
      borderRadius: '8px',
      fontSize: '15px',
      fontWeight: 600,
      cursor: 'pointer',
      transition: 'all 0.2s',
    },
    link: {
      color: '#667eea',
      textDecoration: 'none',
      fontWeight: 500,
    },
    testBox: {
      backgroundColor: '#ecfdf5',
      border: '1px solid #6ee7b7',
      borderRadius: '8px',
      padding: '16px',
      marginTop: '16px',
    },
    testTitle: {
      fontSize: '15px',
      fontWeight: 600,
      color: '#065f46',
      marginBottom: '8px',
    },
    testUrl: {
      fontSize: '13px',
      color: '#047857',
      fontFamily: 'monospace',
      wordBreak: 'break-all',
    },
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.title}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
            Cloudflare Worker 配置教程
          </h2>
          <button style={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        {/* Content */}
        <div style={styles.content}>
          {/* 第一阶段：准备域名 */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>
              <span>🌐</span> 第一阶段：准备域名（Domain）
            </h3>
            <div style={styles.phase}>
              <div style={styles.phaseTitle}>
                <span style={styles.phaseNumber}>1</span>
                添加域名
              </div>
              <p style={styles.sectionDesc}>
                将你的域名（如 <code style={styles.code}>hhxyyq.online</code>）托管到 Cloudflare。
              </p>
            </div>
            <div style={styles.phase}>
              <div style={styles.phaseTitle}>
                <span style={styles.phaseNumber}>2</span>
                激活电子邮件路由
              </div>
              <ol style={styles.ol}>
                <li style={styles.li}>进入 Cloudflare 控制台，选择你的域名</li>
                <li style={styles.li}>点击左侧菜单 <strong>"电子邮件 (Email)"</strong> → <strong>"电子邮件路由 (Email Routing)"</strong></li>
                <li style={styles.li}>点击 <strong>"启用电子邮件路由"</strong></li>
                <li style={styles.li}>
                  <strong>关键步骤</strong>：在"DNS 设置"页签，点击 <strong>"自动添加记录"</strong>
                  <div style={styles.important}>
                    确保 MX 记录和 SPF 记录状态都变为"已激活"
                  </div>
                </li>
              </ol>
            </div>
          </div>

          {/* 第二阶段：创建数据库 */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>
              <span>🗄️</span> 第二阶段：创建数据库（D1 Database）
            </h3>
            <ol style={styles.ol}>
              <li style={styles.li}>在 Cloudflare 侧边栏点击 <strong>"存储和数据库"</strong> → <strong>"D1"</strong></li>
              <li style={styles.li}>点击 <strong>"创建数据库"</strong> → <strong>"创建"</strong></li>
              <li style={styles.li}>
                名称：输入 <code style={styles.code}>trae-emails</code>（或者你喜欢的名字）
              </li>
              <li style={styles.li}>
                创建成功后，点击进入该数据库，选择 <strong>"控制台 (Console)"</strong>
              </li>
              <li style={styles.li}>
                初始化表结构：粘贴以下 SQL 代码并点击 <strong>"执行"</strong>：
                <div style={{ marginTop: '12px', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
                  {/* SQL 代码头部 */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: '#f9fafb', borderBottom: showSql ? '1px solid #e5e7eb' : 'none' }}>
                    <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: 500 }}>SQL</span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(`CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  address TEXT,
  source TEXT,
  subject TEXT,
  content TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);`);
                          setSqlCopied(true);
                          setTimeout(() => setSqlCopied(false), 2000);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '6px 12px',
                          fontSize: '12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          background: '#fff',
                          color: sqlCopied ? '#059669' : '#374151',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                      >
                        {sqlCopied ? (
                          <>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                            已复制
                          </>
                        ) : (
                          <>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                            </svg>
                            复制
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => setShowSql(!showSql)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '6px 12px',
                          fontSize: '12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          background: '#fff',
                          color: '#374151',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: showSql ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                          <polyline points="6 9 12 15 18 9"/>
                        </svg>
                        {showSql ? '收起' : '展开'}
                      </button>
                    </div>
                  </div>
                  {/* SQL 代码内容 */}
                  {showSql && (
                    <pre style={{ ...styles.codeBlock, margin: 0, borderRadius: 0 }}>{`CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  address TEXT,
  source TEXT,
  subject TEXT,
  content TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);`}</pre>
                  )}
                </div>
              </li>
            </ol>
          </div>

          {/* 第三阶段：部署 Worker 脚本 */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>
              <span>⚡</span> 第三阶段：部署 Worker 脚本
            </h3>
            <ol style={styles.ol}>
              <li style={styles.li}>在侧边栏点击 <strong>"Workers 和 Pages"</strong> → <strong>"创建"</strong> → <strong>"创建 Worker"</strong></li>
              <li style={styles.li}>名称：输入 <code style={styles.code}>trae-temp-mail</code></li>
              <li style={styles.li}>点击 <strong>"部署"</strong>，然后点击 <strong>"编辑代码"</strong></li>
              <li style={styles.li}>
                清空内容，粘贴以下经过优化的完整代码（支持 5 分钟清理、Base64 解码、精准提取）：
                <button 
                  style={styles.expandButton} 
                  onClick={() => setShowCode(!showCode)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    {showCode ? (
                      <path d="M18 15l-6-6-6 6"/>
                    ) : (
                      <path d="M6 9l6 6 6-6"/>
                    )}
                  </svg>
                  {showCode ? '收起代码' : '点击展开查看完整代码'}
                </button>
                {showCode && (
                  <div style={{ position: 'relative', marginTop: '12px' }}>
                    <button
                      style={{
                        ...styles.copyButton,
                        ...(copied ? styles.copyButtonCopied : {}),
                      }}
                      onClick={handleCopyCode}
                    >
                      {copied ? (
                        <>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                          已复制
                        </>
                      ) : (
                        <>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                          </svg>
                          复制代码
                        </>
                      )}
                    </button>
                    <pre style={styles.codeBlock}>{workerCode}</pre>
                  </div>
                )}
              </li>
              <li style={styles.li}>点击右上角 <strong>"部署"</strong></li>
            </ol>
          </div>

          {/* 第四阶段：配置绑定 */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>
              <span>🔗</span> 第四阶段：配置绑定（关键，决定能否运行）
            </h3>
            <p style={styles.sectionDesc}>
              回到 Worker 的管理界面，点击 <strong>"设置 (Settings)"</strong> 选项卡。
            </p>
            
            <div style={styles.phase}>
              <div style={styles.phaseTitle}>
                <span style={styles.phaseNumber}>1</span>
                绑定数据库
              </div>
              <ol style={styles.ol}>
                <li style={styles.li}>点击左侧 <strong>"变量 (Variables)"</strong> → 往下滚到 <strong>"D1 数据库绑定"</strong></li>
                <li style={styles.li}>点击 <strong>"添加绑定"</strong></li>
                <li style={styles.li}>变量名称：填写 <code style={styles.code}>DB</code>（必须大写）</li>
                <li style={styles.li}>D1 数据库：选择你刚才创建的 <code style={styles.code}>trae-emails</code></li>
                <li style={styles.li}>点击 <strong>"保存"</strong></li>
              </ol>
            </div>

            <div style={styles.phase}>
              <div style={styles.phaseTitle}>
                <span style={styles.phaseNumber}>2</span>
                设置密钥
              </div>
              <ol style={styles.ol}>
                <li style={styles.li}>在同一个"变量"页面，点击顶部 <strong>"环境变量"</strong> 处的 <strong>"添加变量"</strong></li>
                <li style={styles.li}>名称：<code style={styles.code}>SECRET_KEY</code></li>
                <li style={styles.li}>值：设置你的密钥（如 <code style={styles.code}>qweasd123</code>）</li>
                <li style={styles.li}>点击 <strong>"保存并部署"</strong></li>
              </ol>
            </div>

            <div style={styles.phase}>
              <div style={styles.phaseTitle}>
                <span style={styles.phaseNumber}>3</span>
                添加自定义域名
              </div>
              <ol style={styles.ol}>
                <li style={styles.li}>点击左侧 <strong>"域和路由 (Domains & Routes)"</strong></li>
                <li style={styles.li}>点击 <strong>"添加"</strong> → <strong>"自定义域"</strong></li>
                <li style={styles.li}>输入 <code style={styles.code}>hhxyyq.online</code> 并确认</li>
              </ol>
            </div>
          </div>

          {/* 第五阶段：打通邮件通道 */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>
              <span>📧</span> 第五阶段：打通邮件通道（最后一步）
            </h3>
            <ol style={styles.ol}>
              <li style={styles.li}>回到域名控制台（<code style={styles.code}>hhxyyq.online</code>）</li>
              <li style={styles.li}>点击 <strong>"电子邮件"</strong> → <strong>"电子邮件路由"</strong> → <strong>"路由规则"</strong></li>
              <li style={styles.li}>找到 <strong>"Catch-all"</strong> (捕获所有)，点击 <strong>"编辑"</strong></li>
              <li style={styles.li}>操作：选择 <strong>"发送到 Worker"</strong></li>
              <li style={styles.li}>目标 Worker：选择 <code style={styles.code}>trae-temp-mail</code></li>
              <li style={styles.li}>点击保存</li>
            </ol>
          </div>

          {/* 如何测试 */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>
              <span>🧪</span> 第六阶段：测试验证
            </h3>
            
            <div style={styles.phase}>
              <div style={styles.phaseTitle}>
                <span style={styles.phaseNumber}>1</span>
                测试邮件接收
              </div>
              <ol style={styles.ol}>
                <li style={styles.li}>用你的 QQ 邮箱或其他邮箱，发送一封包含 6 位数字验证码的邮件到 <code style={styles.code}>test@hhxyyq.online</code></li>
                <li style={styles.li}>邮件主题建议包含 "验证码"、"verification" 或 "code" 关键词</li>
                <li style={styles.li}>邮件内容中包含 6 位数字，如：您的验证码是 <strong>123456</strong></li>
              </ol>
            </div>

            <div style={styles.phase}>
              <div style={styles.phaseTitle}>
                <span style={styles.phaseNumber}>2</span>
                调用 API 获取验证码
              </div>
              <p style={styles.sectionDesc}>
                在浏览器地址栏输入以下 URL（替换为你的密钥和邮箱）：
              </p>
              <div style={styles.testBox}>
                <div style={styles.testTitle}>测试 URL 格式</div>
                <div style={styles.testUrl}>
                  https://hhxyyq.online/api/get-code?key=你的SECRET_KEY&email=test@hhxyyq.online
                </div>
              </div>
              <div style={{...styles.note, marginTop: '12px'}}>
                <strong>成功返回示例：</strong>
                <pre style={{...styles.codeBlock, marginTop: '8px', fontSize: '11px'}}>{`{
  "email": "test@hhxyyq.online",
  "code": "123456",
  "time": "2024-01-15 14:30:25 (北京时间)"
}`}</pre>
              </div>
            </div>

            <div style={styles.phase}>
              <div style={styles.phaseTitle}>
                <span style={styles.phaseNumber}>3</span>
                使用 curl 测试（可选）
              </div>
              <pre style={{...styles.codeBlock, fontSize: '11px'}}>{`curl "https://hhxyyq.online/api/get-code?key=你的密钥&email=test@hhxyyq.online"`}</pre>
            </div>
          </div>

          {/* 常见问题 */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>
              <span>❓</span> 常见问题与解决方案
            </h3>

            <div style={{...styles.phase, backgroundColor: '#fef2f2', padding: '16px', borderRadius: '8px', borderLeft: '4px solid #ef4444'}}>
              <div style={{...styles.phaseTitle, color: '#dc2626'}}>
                <span style={{...styles.phaseNumber, background: '#dc2626'}}>!</span>
                问题 1：返回 "密钥错误"
              </div>
              <ul style={{ margin: '0 0 0 20px', padding: 0, color: '#4b5563', fontSize: '14px', lineHeight: 1.8 }}>
                <li style={styles.li}>检查 URL 中的 <code style={styles.code}>key</code> 参数值是否与 Worker 环境变量中设置的 <code style={styles.code}>SECRET_KEY</code> 完全一致</li>
                <li style={styles.li}>注意区分大小写，不要有多余空格</li>
                <li style={styles.li}>确认已点击"保存并部署"使环境变量生效</li>
              </ul>
            </div>

            <div style={{...styles.phase, backgroundColor: '#fef2f2', padding: '16px', borderRadius: '8px', borderLeft: '4px solid #ef4444', marginTop: '16px'}}>
              <div style={{...styles.phaseTitle, color: '#dc2626'}}>
                <span style={{...styles.phaseNumber, background: '#dc2626'}}>!</span>
                问题 2：返回 "未找到包含验证码的邮件，或已过期"
              </div>
              <ul style={{ margin: '0 0 0 20px', padding: 0, color: '#4b5563', fontSize: '14px', lineHeight: 1.8 }}>
                <li style={styles.li}><strong>检查邮件是否发送成功</strong>：确认邮件已发出且没有退信</li>
                <li style={styles.li}><strong>检查邮箱地址</strong>：确保发送到的邮箱地址与查询的地址完全一致</li>
                <li style={styles.li}><strong>检查验证码格式</strong>：邮件中必须包含 6 位纯数字（如 123456）</li>
                <li style={styles.li}><strong>检查数据保留时间</strong>：邮件只在数据库中保留 1 分钟，超时会被自动清理</li>
                <li style={styles.li}><strong>检查邮件主题</strong>：邮件主题需要包含 verification / 验证码 / code 关键词才会被存储</li>
              </ul>
            </div>

            <div style={{...styles.phase, backgroundColor: '#fef2f2', padding: '16px', borderRadius: '8px', borderLeft: '4px solid #ef4444', marginTop: '16px'}}>
              <div style={{...styles.phaseTitle, color: '#dc2626'}}>
                <span style={{...styles.phaseNumber, background: '#dc2626'}}>!</span>
                问题 3：返回 404 或无法访问
              </div>
              <ul style={{ margin: '0 0 0 20px', padding: 0, color: '#4b5563', fontSize: '14px', lineHeight: 1.8 }}>
                <li style={styles.li}>检查 Worker 是否已部署成功</li>
                <li style={styles.li}>检查自定义域名是否正确配置并生效（DNS 可能需要几分钟）</li>
                <li style={styles.li}>确认 URL 路径是 <code style={styles.code}>/api/get-code</code> 而不是其他路径</li>
              </ul>
            </div>

            <div style={{...styles.phase, backgroundColor: '#fef2f2', padding: '16px', borderRadius: '8px', borderLeft: '4px solid #ef4444', marginTop: '16px'}}>
              <div style={{...styles.phaseTitle, color: '#dc2626'}}>
                <span style={{...styles.phaseNumber, background: '#dc2626'}}>!</span>
                问题 4：邮件路由不工作（收不到邮件）
              </div>
              <ul style={{ margin: '0 0 0 20px', padding: 0, color: '#4b5563', fontSize: '14px', lineHeight: 1.8 }}>
                <li style={styles.li}>确认域名已正确托管到 Cloudflare（名称服务器已更改）</li>
                <li style={styles.li}>检查 Email Routing 是否已启用并显示"已激活"</li>
                <li style={styles.li}>确认 Catch-all 规则已设置为"发送到 Worker"</li>
                <li style={styles.li}>检查 Worker 日志查看是否有邮件处理错误</li>
              </ul>
            </div>

            <div style={{...styles.phase, backgroundColor: '#fef2f2', padding: '16px', borderRadius: '8px', borderLeft: '4px solid #ef4444', marginTop: '16px'}}>
              <div style={{...styles.phaseTitle, color: '#dc2626'}}>
                <span style={{...styles.phaseNumber, background: '#dc2626'}}>!</span>
                问题 5：数据库相关错误
              </div>
              <ul style={{ margin: '0 0 0 20px', padding: 0, color: '#4b5563', fontSize: '14px', lineHeight: 1.8 }}>
                <li style={styles.li}>确认 D1 数据库已正确绑定到 Worker，变量名必须是 <code style={styles.code}>DB</code></li>
                <li style={styles.li}>检查数据库表是否已创建（代码会自动创建，但首次可能需要等待）</li>
                <li style={styles.li}>查看 Worker 日志获取详细错误信息</li>
              </ul>
            </div>
          </div>

          {/* 调试技巧 */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>
              <span>🔧</span> 调试技巧
            </h3>
            <ol style={styles.ol}>
              <li style={styles.li}>
                <strong>查看 Worker 日志</strong>：在 Cloudflare 控制台 → Workers → 你的 Worker → "日志" 标签页，可以看到实时日志和错误信息
              </li>
              <li style={styles.li}>
                <strong>使用 D1 控制台查询</strong>：进入 D1 数据库 → 控制台，执行 <code style={styles.code}>SELECT * FROM messages ORDER BY id DESC LIMIT 10;</code> 查看最近存储的邮件
              </li>
              <li style={styles.li}>
                <strong>测试邮件发送</strong>：先用简单的文本邮件测试，确认流程正常后再测试 HTML 邮件
              </li>
              <li style={styles.li}>
                <strong>检查时间同步</strong>：确保邮件发送和 API 查询的时间间隔在 1 分钟内
              </li>
            </ol>
          </div>

          {/* 注意事项 */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>
              <span>⚠️</span> 注意事项
            </h3>
            <ul style={{ margin: '0 0 0 20px', padding: 0, color: '#4b5563', fontSize: '14px', lineHeight: 2 }}>
              <li style={styles.li}><strong>安全性</strong>：请妥善保管 <code style={styles.code}>SECRET_KEY</code>，不要泄露给他人</li>
              <li style={styles.li}><strong>数据保留</strong>：临时邮箱数据会在 1 分钟后自动删除</li>
              <li style={styles.li}><strong>验证码格式</strong>：只支持提取 6 位纯数字验证码</li>
              <li style={styles.li}><strong>免费额度</strong>：Cloudflare Worker 免费版每日 100,000 次请求，D1 每日 500 万次查询</li>
            </ul>
          </div>
        </div>

        {/* Actions */}
        <div style={styles.actions}>
          <button style={styles.button} onClick={onClose}>
            我知道了
          </button>
        </div>
      </div>
    </div>
  );
}
