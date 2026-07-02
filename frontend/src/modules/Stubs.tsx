import React from 'react'
import GlassPanel from '@/components/GlassPanel'
import {
    Shield, Map as MapIcon, Building2, Compass, GraduationCap, Music as MusicIcon, Wallet,
    HeartPulse, Brush, Globe2, Timer, Trophy, BarChart3, BookHeart,
} from 'lucide-react'

const Stub: React.FC<{
  title: string
  subtitle: string
  hint: string
  icon: React.ReactNode
  features: string[]
}> = ({ title, subtitle, hint, icon, features }) => (
  <div className="p-6 space-y-4">
    <GlassPanel
      title={title}
      subtitle={subtitle}
      meta={<span className="pt-chip text-sig-warn border-sig-warn">WIP</span>}
      scanline
    >
      <div className="mt-4 flex items-start gap-4">
        <div className="w-16 h-16 border border-accent text-accent flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div className="flex-1">
          <div className="text-sm text-text-mid leading-relaxed">{hint}</div>
          <div className="mt-4">
            <div className="pt-section-label text-text-lo mb-2">PLANNED FEATURES</div>
            <ul className="space-y-1 text-xs text-text-mid">
              {features.map((f, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-accent pt-mono">▸</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </GlassPanel>

    <div className="pt-glass p-6 text-center text-text-lo">
      <div className="pt-section-label mb-2">UNDER CONSTRUCTION</div>
      <div className="text-xs">本模块的 UI 与后端逻辑将在后续版本完成。可通过插件机制提前接入。</div>
    </div>
  </div>
)

export const Passwords: React.FC = () => <Stub
  title="PASSWORDS · 密码管理器"
  subtitle="AES-256-GCM 加密 · 主密码 · Edge CSV 导入"
  hint="从 Edge 导出的 CSV 一键导入；主密码加密；剪贴板 30 秒清空；2FA 备份码、安全问题、强度检测、弱/重复密码标记。"
  icon={<Shield size={28} />}
  features={[
    '主密码 AES-256-GCM 加密整库，明文仅短暂驻留内存',
    'Edge 密码 CSV 导入：name / url / username / password 自动映射',
    '强度检测、弱密码与重复密码高亮',
    '一键复制密码，30 秒后自动清空剪贴板',
    '2FA 备份码、安全问题字段支持',
  ]}
/>

export const Detective: React.FC = () => <Stub
  title="DETECTIVE BOARD · 侦探线索板"
  subtitle="自由画布 · 人物 / 地点 / 事件 / 物证 / 假设节点 + 红绳连线"
  hint="致敬经典悬疑电影的软木板。卡片节点可拖拽缩放，节点间用红绳连线；支持把笔记、网页快照、图片钉上来。"
  icon={<Compass size={28} />}
  features={[
    '无限画布 · 缩放 · 拖拽 · 多视角保存',
    '节点类型：人物 / 地点 / 事件 / 物证 / 假设',
    '红绳连线，支持「确认」「怀疑」「排除」三种关系',
    '把任何笔记、书签、图片钉到板上',
    '导出为 SVG / PNG，截图发推就是大片',
  ]}
/>

export const Travel: React.FC = () => <Stub
  title="TRAVEL · 旅游日记"
  subtitle="行程时间轴 · 地图视图 · 照片墙 · EXIF 自动定位"
  hint="行程时间轴 + 地图视图（Leaflet/OSM 或高德），从照片 EXIF 自动提取拍摄地与时间；可导出 PDF 纪念册。"
  icon={<MapIcon size={28} />}
  features={[
    '每日条目：照片墙、消费记录、心情打分、行程点',
    'EXIF GPS 自动提取与地图标记',
    '时间轴视图 + 地图视图双视',
    '消费汇总自动归入「财务」模块',
    '导出 PDF 纪念册 / 网页分享',
  ]}
/>

export const Institute: React.FC = () => <Stub
  title="INSTITUTE · 「学院」"
  subtitle="致敬辐射 4 学院 · 个人远期梦想的组织化记录"
  hint="把人生远期梦想结构化：部门（每个职能一张卡）、行动（当前在做的事）、阶段（项目里程碑）。看板 + 时间线 + 组织架构三视图。"
  icon={<Building2 size={28} />}
  features={[
    '部门（Departments）：职能 / 幻想中的人员 / 关联项目',
    '行动（Actions）：状态 / 负责部门 / 进度',
    '阶段（Phases）：阶段目标 / 完成度 / 关键里程碑 / 复盘',
    '看板、时间线、组织架构图 三视图切换',
    '与 Fascinator 联动：高层目标 → 程序性记忆 → 自动行动队列',
  ]}
/>

export const Learning: React.FC = () => <Stub
  title="LEARNING · 学习功能"
  subtitle="单词 · 驾考 · AI 思考题 · 浮窗小窗模式"
  hint="单词背诵（艾宾浩斯）、驾考题库、本科课程思考题、AI 自问自答；可弹出 320×200 浮窗常驻置顶。"
  icon={<GraduationCap size={28} />}
  features={[
    '导入 Anki APKG / JSON / CSV 单词书（kajweb/dict 等）',
    '艾宾浩斯曲线复习算法、发音 TTS',
    '驾考科目一 / 科目四题库（jiakaobaodian 抓取）',
    '本科思考题 + AI 自动出题（接 Claude / GPT API）',
    '浮窗模式：320×200 常驻置顶，空闲弹一题',
  ]}
/>

export const Music: React.FC = () => <Stub
  title="MUSIC · 音乐 / 播客"
  subtitle="本地音乐库 · Last.fm scrobble · 播客订阅"
  hint="本地 mp3/flac/m4a 扫描，封面与元数据提取，类 iTunes 播放器；歌词同步；Last.fm scrobble；播客 RSS 订阅。"
  icon={<Music size={28} />}
  features={[
    '本地音乐库扫描与播放（mp3 / flac / m4a / wav）',
    '歌词同步显示，可上传自定义 LRC',
    'Last.fm scrobble · Spotify Web API 对接',
    '播客 RSS 订阅与收听进度同步',
    '心情标签：工作 / 运动 / 睡前 / 雨天...',
  ]}
/>

export const Finance: React.FC = () => <Stub
  title="FINANCE · 个人财务"
  subtitle="支付宝/微信账单 CSV 导入 · 预算 · 桑基图 · 订阅服务"
  hint="收支记录、支付宝/微信 CSV 导入；按月按类别预算与超支提醒；资产统计（存款/投资/负债）；桑基图、饼图、月度对比。"
  icon={<Wallet size={28} />}
  features={[
    '收支记录（手动 + CSV 导入）',
    '支付宝 / 微信账单 CSV 自动解析与归类',
    '预算管理：按月、按类别、超支提醒（Toast）',
    '资产看板：存款 / 投资 / 负债 / 净资产趋势',
    '消费分析：饼图 / 桑基图 / 月度对比',
    '订阅服务提醒（Netflix / 服务器 / 域名续费）',
  ]}
/>

export const Health: React.FC = () => <Stub
  title="HEALTH · 健康追踪"
  subtitle="体重 · 睡眠（联动梦境）· 习惯养成 · 系统 Toast"
  hint="体重、体脂、血压记录；运动日志（导入小米/华为/Apple Health）；睡眠分析联动「梦境记录」；喝水/护眼/站立每小时 Toast 提醒。"
  icon={<HeartPulse size={28} />}
  features={[
    '体重 / 体脂 / 血压 / 静息心率',
    '运动日志，对接小米 / 华为 / Apple Health 导出',
    '饮食记录（可选拍照 + AI 识别热量）',
    '睡眠分析 → 联动「梦境记录」模板',
    '习惯养成：喝水 / 护眼 / 站立每小时 Toast',
  ]}
/>

export const Creative: React.FC = () => <Stub
  title="CREATIVE · 创意工作台"
  subtitle="Excalidraw 画板 · 情绪板 · 写作模式 · 故事卡片"
  hint="Excalidraw 嵌入画板；Moodboard 情绪板（配色/排版/灵感图）；专注全屏写作模式与字数目标；故事大纲（情节/人物/场景卡）。"
  icon={<Brush size={28} />}
  features={[
    'Excalidraw 画板嵌入（或自研轻量画板）',
    'Moodboard 情绪板：配色 / 排版 / 灵感图收集',
    '专注全屏写作：字数统计、Daily Word Goal',
    '故事大纲卡片：情节卡 / 人物卡 / 场景卡，拖拽编排',
  ]}
/>

export const Network: React.FC = () => <Stub
  title="NETWORK · 网络工具箱"
  subtitle="IP/DNS/Ping/端口 · 编码转换 · 正则测试 · API 调试"
  hint="网络小工具集合：IP/DNS/Ping/端口/Whois；Base64/URL/MD5/SHA/JSON 格式化；取色器、配色与渐变；正则测试；API 调试。"
  icon={<Globe2 size={28} />}
  features={[
    'IP / DNS / Ping / 端口检测 / Whois 查询',
    '编码转换：Base64 / URL / MD5 / SHA / JSON',
    '颜色工具：系统级取色器、配色方案、渐变生成',
    '正则表达式测试与常用模式库',
    'API 调试（简化版 Postman）：请求构造 / 历史 / 环境变量',
  ]}
/>

export const Time: React.FC = () => <Stub
  title="TIME · 时间追踪"
  subtitle="番茄钟 · Time Blocking · 自动应用时长（RescueTime 风格）"
  hint="番茄钟（工作/休息时长可调）；Time Blocking 时间块规划；Windows 下 GetForegroundWindow 轮询自动统计应用使用时长；周月报告堆叠图；Chill Pulse 等专注软件状态联动。"
  icon={<Timer size={28} />}
  features={[
    '番茄钟：可自定义工作 / 休息时长，状态栏显示',
    'Time Blocking：每日时间块可视化规划',
    '自动应用使用时长（Windows GetForegroundWindow 轮询）',
    '周 / 月报告：堆叠柱状图、应用类别分布',
    '专注软件联动：Chill Pulse / Gogh 状态读取',
  ]}
/>

export const RPG: React.FC = () => <Stub
  title="RPG · 游戏化系统"
  subtitle="经验值 · 成就 · 六维属性 · 人生看板"
  hint="完成任务/习惯/单词 → XP + 金币；成就系统（如「连续记梦 7 天」「读完 5 本书」）；等级与称号；人生 RPG 六维（体力/智力/创造/社交/财力/意志）。"
  icon={<Trophy size={28} />}
  features={[
    'XP 与金币系统，完成任意模块的关键行为均奖励',
    '成就解锁：「连续记梦 7 天」「收集 10 种武器」...',
    '等级与称号 / 头衔',
    '人生 RPG 六维属性看板（雷达图）',
    '可选「死亡警告」：长期未运动 → 体力衰减提示',
  ]}
/>

export const Data: React.FC = () => <Stub
  title="DATA · 个人数据中心"
  subtitle="跨模块仪表盘 · 年度回顾 · 热力图"
  hint="跨模块数据汇总仪表盘；自动生成年度回顾（Year in Review）；趋势分析（书/字数/睡眠）；词云、时间线、GitHub 风格热力图。"
  icon={<BarChart3 size={28} />}
  features={[
    '跨模块汇总仪表盘：今日、本周、本月、本年',
    '年度回顾（Year in Review）一键生成',
    '趋势分析：看了多少书、写了多少字、睡了多久',
    '可视化：词云 / 时间线 / GitHub 风格热力图',
    '数据导出：JSON / Markdown / PDF 全量备份',
  ]}
/>

export const Diary: React.FC = () => <Stub
  title="DIARY · 日记 / 总结"
  subtitle="每日一句 · 周/月/年自动汇总 · 历史上的今天 · 作品感想"
  hint="One-Line a Day 每日一句日记；周/月/年自动聚合各模块数据；历史上的今天；年度词/年度照片/年度数据；作品感想自动关联收藏。"
  icon={<BookHeart size={28} />}
  features={[
    'One-Line a Day 每日一句日记',
    '每周 / 每月 / 每年自动汇总（聚合各模块数据）',
    '历史上的今天：去年的此刻你在做什么',
    '年度词 / 年度照片 / 年度数据',
    '作品感想：玩完游戏 / 看完书后的感受 → 关联收藏',
  ]}
/>
