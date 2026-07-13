<script setup lang="ts">
import { ref, computed, nextTick, shallowRef } from 'vue'
import { root, commandManager } from '@core/index'
import { SizeVisitor, SearchVisitor, XmlExportVisitor } from '@core/visitor'
import { TagCommand } from '@core/command'
import type { FileSystemNode } from '@core/composite'
import { Directory, WordFile, ImageFile, TextFile } from '@core/composite'
import FileTreeNode from './components/FileTreeNode.vue'

// ─────────────────────────────────────────────────────────────
// Force Update（讓 OOP Class 的 mutation 能觸發畫面刷新）
// ─────────────────────────────────────────────────────────────
const updateKey = ref(0)
const forceUpdate = () => { updateKey.value++ }

// ─────────────────────────────────────────────────────────────
// Selected Node
// ─────────────────────────────────────────────────────────────
const selectedNode = shallowRef<FileSystemNode | null>(null)
const selectNode = (node: FileSystemNode) => { selectedNode.value = node }

/** #1 路徑追溯：利用 getPath() 決定實時計算 */
const selectedPath = computed(() =>
  selectedNode.value ? selectedNode.value.getPath() : ''
)

/** 操作作用範圍：如果有選取節點則對其執行，否則回視到 root */
const activeScope = computed(() => selectedNode.value ?? root)

/** 根據節點型別回傳對應 Emoji */
const getNodeIcon = (node: FileSystemNode): string => {
  if (node instanceof Directory) return '📁'
  if (node instanceof WordFile)  return '📄'
  if (node instanceof ImageFile) return '🖼️'
  if (node instanceof TextFile)  return '📝'
  return '📄'
}

// ─────────────────────────────────────────────────────────────
// Console Log 攔截 → 導流到系統日誌面板
// ─────────────────────────────────────────────────────────────
type LogType = 'scan' | 'command' | 'undo' | 'system' | 'info' | 'start'

interface LogEntry { id: number; message: string; type: LogType }

const logs = ref<LogEntry[]>([])
const logContainer = ref<HTMLElement | null>(null)
let _logId = 0

const resolveLogType = (msg: string): LogType => {
  if (msg.startsWith('掃描節點'))   return 'scan'
  if (msg.startsWith('[Command]')) return 'command'
  if (msg.startsWith('[Undo]') || msg.startsWith('[Redo]')) return 'undo'
  if (msg.startsWith('[系統]'))     return 'system'
  return 'info'
}

const logClass = (type: LogType): string =>
  ({
    scan:    'text-gray-500',
    command: 'text-[#58a6ff]',
    undo:    'text-yellow-400',
    system:  'text-orange-400',
    info:    'text-gray-300',
    start:   'text-green-400 font-semibold',
  } as Record<LogType, string>)[type] ?? 'text-gray-300'

// 立即攔截（在 setup 階段執行，早於任何 Visitor/Command 呼叫）
;(() => {
  const orig = console.log
  console.log = (...args: unknown[]) => {
    orig(...args)
    const msg = args
      .map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a)))
      .join(' ')
    logs.value.push({ id: _logId++, message: msg, type: resolveLogType(msg) })
    nextTick(() => {
      if (logContainer.value) {
        logContainer.value.scrollTop = logContainer.value.scrollHeight
      }
    })
  }
})()

const clearLogs = () => { logs.value = [] }

// ─────────────────────────────────────────────────────────────
// #2 Visitor 操作（對 activeScope 執行，不再寫死對 root）
// ─────────────────────────────────────────────────────────────
interface VisitorResult { title: string; content: string }
const visitorResult = ref<VisitorResult | null>(null)

/** 推入一條綠色「開始執行」分隔訊息 */
const logStart = (action: string) => {
  logs.value.push({ id: _logId++, message: `▶ 開始執行 ${action}`, type: 'start' })
}

const calcSize = () => {
  const scope = activeScope.value
  logStart(`計算容量（範圍: ${scope.name}）`)
  const v = new SizeVisitor()
  const size = scope.accept(v) as number
  visitorResult.value = {
    title:   '📦 總容量計算結果',
    content: `範圍：${scope.name}\n總容量：${size} KB（${(size / 1024).toFixed(2)} MB）`,
  }
}

// #3 動態搜尋：searchQuery 由使用者輸入
const searchQuery = ref('.docx')

const runSearch = () => {
  const scope = activeScope.value
  const query = searchQuery.value.trim()
  if (!query) {
    logs.value.push({ id: _logId++, message: '[系統] 請輸入搜尋關鍵字', type: 'system' })
    return
  }
  logStart(`搜尋「${query}」（範圍: ${scope.name}）`)
  // 建立 SearchVisitor，對 activeScope 執行遍歷
  const v = new SearchVisitor(query)
  scope.accept(v)
  // 透過 getResults() 取得所有深層符合節點
  const found = v.getResults()
  visitorResult.value = {
    title: `🔍 搜尋結果：「${query}」（範圍: ${scope.name}，共 ${found.length} 筆）`,
    content: found.length > 0
      ? found.map(f => `• ${f.name}  [${f.size} KB]  ${f.getPath()}`).join('\n')
      : '找不到符合的節點',
  }
}

const exportXml = () => {
  const scope = activeScope.value
  logStart(`匯出 XML（範圍: ${scope.name}）`)
  const v = new XmlExportVisitor()
  visitorResult.value = {
    title:   '📝 XML 匯出結果',
    content: scope.accept(v) as string,
  }
}

// ─────────────────────────────────────────────────────────────
// #4 Command 操作：Toggle 標簽（已有則移除，未有則新增）
// ─────────────────────────────────────────────────────────────
const toggleTag = (tag: string) => {
  if (!selectedNode.value) {
    logs.value.push({
      id: _logId++,
      message: '[系統] 請先在左側選取一個節點後，再執行 Command 操作',
      type: 'system',
    })
    return
  }
  // TagCommand 構造式自動 Toggle
  commandManager.execute(new TagCommand(selectedNode.value, tag))
  forceUpdate()
}

// #5 Undo：按鈕正确 disabled + 動態顯示最後一個命令名稱
const undoCmd = () => {
  commandManager.undo()
  forceUpdate()
}

/** 判斷選取節點是否已有某標簽（給按鈕顯示 Toggle 狀態） */
const hasTag = (tag: string): boolean =>
  !!selectedNode.value?.tags.has(tag)
</script>

<template>
  <div class="flex flex-col h-screen overflow-hidden bg-[#0d1117] text-gray-300 font-sans">

    <!-- ╔══════════════════════════════════════════ HEADER ════╗ -->
    <header
      class="flex-none flex items-center gap-4 px-6 py-3 bg-[#161b22] border-b border-[#30363d] z-10 shadow-lg shadow-black/20"
    >
      <!-- Logo + title -->
      <div class="flex items-center gap-3">
        <div
          class="w-9 h-9 rounded-xl flex items-center justify-center text-lg shadow-md shadow-blue-500/20"
          style="background: linear-gradient(135deg, #2563eb, #06b6d4)"
        >☁️</div>
        <div>
          <h1 class="text-[15px] font-bold text-white leading-tight tracking-tight">
            雲端檔案管理系統
          </h1>
          <p class="text-[10px] text-gray-600 font-mono">
            Cloud File Management System
          </p>
        </div>
      </div>

      <!-- Badges -->
      <div class="ml-auto hidden md:flex items-center gap-2">
        <span class="badge-pill bg-green-500/10 border-green-500/20 text-green-400">
          <span class="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
          系統運行中
        </span>
        <span class="badge-pill bg-purple-500/10 border-purple-500/20 text-purple-400">Composite</span>
        <span class="badge-pill bg-[#58a6ff]/10 border-[#58a6ff]/20 text-[#58a6ff]">Visitor</span>
        <span class="badge-pill bg-orange-500/10 border-orange-500/20 text-orange-400">Command</span>
      </div>
    </header>

    <!-- ╔══════════════════════════════════════════ BODY ══════╗ -->
    <div class="flex flex-1 overflow-hidden">

      <!-- ┌─────────────── LEFT: FILE TREE ──────────────────┐ -->
      <aside
        class="flex-none w-[360px] flex flex-col bg-[#161b22] border-r border-[#30363d] overflow-hidden"
      >
        <!-- Sidebar header -->
        <div class="flex-none flex items-center px-4 py-2.5 border-b border-[#30363d]">
          <span class="text-[11px] font-semibold text-gray-500 uppercase tracking-widest">
            檔案樹
          </span>
          <span class="ml-auto text-[10px] text-gray-700 font-mono">Composite Pattern</span>
        </div>

        <!-- Tree -->
        <div class="flex-1 overflow-y-auto py-2 px-2">
          <FileTreeNode
            :key="updateKey"
            :node="root"
            :selectedNode="selectedNode"
            :depth="0"
            @select="selectNode"
          />
        </div>

        <!-- Selection info footer -->
        <div class="flex-none border-t border-[#30363d] px-3 py-3 bg-[#0d1117]/50">
          <div class="text-[9px] font-mono text-gray-700 uppercase tracking-widest mb-1.5">
            已選取節點
          </div>
          <template v-if="selectedNode">
            <div class="text-[13px] font-semibold text-gray-200 truncate">
              {{ getNodeIcon(selectedNode) }} {{ selectedNode.name }}
            </div>
            <div class="text-[11px] text-gray-600 font-mono mt-0.5">
              {{ selectedNode.size }} KB ·
              {{ selectedNode.createdAt.toLocaleDateString('zh-TW') }}
            </div>
            <div v-if="selectedNode.tags.size > 0" class="flex flex-wrap gap-1 mt-1.5">
              <span
                v-for="tag in selectedNode.tags"
                :key="tag"
                class="text-[10px] font-mono px-1.5 py-px rounded border"
                :class="tag === 'Urgent'
                  ? 'text-red-400 bg-red-500/15 border-red-500/30'
                  : tag === 'Work'
                  ? 'text-[#58a6ff] bg-[#58a6ff]/15 border-[#58a6ff]/30'
                  : 'text-purple-400 bg-purple-500/15 border-purple-500/30'"
              >{{ tag }}</span>
            </div>
          </template>
          <template v-else>
            <span class="text-[12px] text-gray-700 italic">尚未選取</span>
          </template>
        </div>
      </aside>

      <!-- ┌─────────────── RIGHT PANEL ──────────────────────┐ -->
      <div class="flex-1 flex flex-col overflow-hidden">

        <div class="flex-1 overflow-y-auto p-4 space-y-4">

          <!-- ╔══ #1 Current Path Banner ══════════════════════╗ -->
          <div
            v-if="selectedPath"
            class="flex items-center gap-2 px-3 py-2 bg-[#161b22] border border-[#30363d]
                   rounded-lg overflow-hidden"
          >
            <span class="text-[10px] font-mono text-gray-700 flex-none uppercase tracking-widest">路徑</span>
            <span class="text-[11px] font-mono text-[#58a6ff] truncate" :title="selectedPath">
              {{ selectedPath }}
            </span>
          </div>

          <!-- ── Action Cards Row ─────────────────────────── -->
          <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">

            <!-- ── Visitor Panel ── -->
            <div class="panel group hover:border-purple-500/30 transition-colors">
              <div class="panel-header bg-gradient-to-r from-purple-500/5 to-transparent">
                <span class="text-base">🔬</span>
                <span class="text-sm font-semibold text-white">Visitor 操作</span>
                <span class="ml-auto text-[10px] text-gray-700 font-mono">Visitor Pattern</span>
              </div>
              <div class="p-3 space-y-2">
                <!-- Scope hint -->
                <div class="flex items-center gap-1.5 px-2 py-1 mb-1 rounded bg-[#0d1117] border border-[#30363d]">
                  <span class="text-[9px] font-mono text-gray-700 uppercase tracking-widest flex-none">作用範圍</span>
                  <span class="text-[11px] font-mono text-gray-400 truncate">
                    {{ activeScope.name }}
                  </span>
                </div>
                <button @click="calcSize" class="action-btn hover:border-purple-500/25">
                  <span class="icon-badge bg-purple-500/10 border-purple-500/20">📦</span>
                  <span class="action-label">計算總容量</span>
                  <span class="action-hint">SizeVisitor</span>
                </button>
                <!-- #3 Search with dynamic input -->
                <div class="flex gap-1.5">
                  <input
                    v-model="searchQuery"
                    @keyup.enter="runSearch"
                    placeholder="副檔名或關鍵字…"
                    class="flex-1 min-w-0 px-2.5 py-1.5 bg-[#0d1117] border border-[#30363d] rounded-lg
                           text-[12px] font-mono text-gray-300 placeholder-gray-700
                           focus:outline-none focus:border-[#58a6ff]/50 transition-colors"
                  />
                  <button @click="runSearch" class="action-btn !w-auto px-3 hover:border-blue-500/25">
                    <span class="text-sm">🔍</span>
                    <span class="text-[12px] text-gray-300">搜尋</span>
                  </button>
                </div>
                <button @click="exportXml" class="action-btn hover:border-teal-500/25">
                  <span class="icon-badge bg-teal-500/10 border-teal-500/20">📝</span>
                  <span class="action-label">匯出 XML</span>
                  <span class="action-hint">XmlExportVisitor</span>
                </button>
              </div>
            </div>

            <!-- ── Command Panel ── -->
            <div class="panel hover:border-orange-500/30 transition-colors">
              <div class="panel-header bg-gradient-to-r from-orange-500/5 to-transparent">
                <span class="text-base">⚡</span>
                <span class="text-sm font-semibold text-white">Command 操作</span>
                <span class="ml-auto text-[10px] text-gray-700 font-mono">Command Pattern</span>
              </div>
              <div class="p-3 space-y-2">
                <!-- Target info -->
                <div class="flex items-center gap-2 px-3 py-2 bg-[#0d1117] rounded-lg border border-[#30363d] mb-1">
                  <span class="text-[10px] text-gray-700 font-mono flex-none">目標</span>
                  <span
                    class="text-[12px] font-medium truncate"
                    :class="selectedNode ? 'text-gray-200' : 'text-gray-700 italic'"
                  >
                    {{ selectedNode
                       ? `${getNodeIcon(selectedNode)} ${selectedNode.name}`
                       : '← 請先點選左側節點' }}
                  </span>
                </div>
                <!-- #4 Urgent Toggle -->
                <button @click="toggleTag('Urgent')" class="action-btn hover:border-red-500/25">
                  <span class="icon-badge bg-red-500/10 border-red-500/20">🔴</span>
                  <span class="action-label">
                    {{ hasTag('Urgent') ? '移除 Urgent' : '標記 Urgent' }}
                  </span>
                  <span class="action-hint" :class="hasTag('Urgent') ? 'text-red-600' : ''">TagCommand</span>
                </button>
                <!-- #4 Work Toggle -->
                <button @click="toggleTag('Work')" class="action-btn hover:border-[#58a6ff]/25">
                  <span class="icon-badge bg-[#58a6ff]/10 border-[#58a6ff]/20">🔵</span>
                  <span class="action-label">
                    {{ hasTag('Work') ? '移除 Work' : '標記 Work' }}
                  </span>
                  <span class="action-hint" :class="hasTag('Work') ? 'text-[#58a6ff]' : ''">TagCommand</span>
                </button>
                <!-- #5 Undo with dynamic name -->
                <button
                  @click="undoCmd"
                  :disabled="!commandManager.canUndo"
                  class="action-btn hover:border-yellow-500/25 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span class="icon-badge bg-yellow-500/10 border-yellow-500/20">↩</span>
                  <span class="action-label">
                    <template v-if="commandManager.canUndo">
                      Undo
                      <span class="text-yellow-500/80">（復原: {{ commandManager.lastCommandName }}）</span>
                    </template>
                    <template v-else>Undo 復原</template>
                  </span>
                  <span
                    class="action-hint"
                    :class="commandManager.canUndo ? 'text-yellow-600' : ''"
                  >
                    {{ commandManager.canUndo ? `${commandManager.undoCount} 步` : '無可還原' }}
                  </span>
                </button>
              </div>
            </div>

          </div>

          <!-- ── Visitor Result Card ─────────────────────── -->
          <Transition name="result-fade">
            <div v-if="visitorResult" class="panel overflow-hidden">
              <div class="panel-header justify-between">
                <span class="text-sm font-semibold text-white">{{ visitorResult.title }}</span>
                <button
                  @click="visitorResult = null"
                  class="w-6 h-6 rounded-md flex items-center justify-center text-gray-600
                         hover:text-gray-300 hover:bg-white/5 transition-all text-lg leading-none"
                >×</button>
              </div>
              <pre
                class="px-4 py-3 text-[12.5px] font-mono text-gray-300 whitespace-pre-wrap
                       leading-relaxed overflow-auto max-h-52 bg-[#0d1117]/30"
              >{{ visitorResult.content }}</pre>
            </div>
          </Transition>

        </div>

        <!-- ── System Log ─────────────────────────────────── -->
        <div class="flex-none h-52 flex flex-col border-t border-[#30363d] bg-[#080b10]">
          <!-- Toolbar -->
          <div
            class="flex-none flex items-center gap-2 px-4 py-2 bg-[#161b22] border-b border-[#30363d]"
          >
            <!-- macOS-style traffic lights -->
            <div class="flex gap-1.5">
              <div class="w-3 h-3 rounded-full bg-[#ff5f57]"></div>
              <div class="w-3 h-3 rounded-full bg-[#febc2e]"></div>
              <div class="w-3 h-3 rounded-full bg-[#28c840]"></div>
            </div>
            <span class="text-[11px] font-mono text-gray-600 ml-1">
              🖥️ 系統日誌 — console.log interception
            </span>
            <div class="ml-auto flex items-center gap-3">
              <span class="text-[10px] font-mono text-gray-700">
                {{ logs.length }} 條記錄
              </span>
              <button
                @click="clearLogs"
                class="text-[10px] font-mono text-gray-700 hover:text-gray-400 transition-colors
                       px-1.5 py-0.5 rounded hover:bg-white/5"
              >清除</button>
            </div>
          </div>

          <!-- Log body -->
          <div
            ref="logContainer"
            class="flex-1 overflow-y-auto px-4 py-2 space-y-px"
          >
            <div
              v-if="logs.length === 0"
              class="flex items-center gap-2 pt-2 text-gray-700 text-[11px] font-mono"
            >
              <span class="animate-pulse">_</span>
              <span>等待操作輸出...</span>
            </div>
            <div
              v-for="entry in logs"
              :key="entry.id"
              :class="[
                'flex items-start gap-2 py-px font-mono text-[11px] leading-5',
                logClass(entry.type)
              ]"
            >
              <span class="text-gray-800 select-none flex-none mt-px">›</span>
              <span class="break-all">{{ entry.message }}</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<style scoped>
/* ── Reusable layout atoms ─────────────────────────────────── */
.badge-pill {
  @apply inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-mono;
}

.panel {
  @apply bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden;
}

.panel-header {
  @apply flex items-center gap-2 px-4 py-3 border-b border-[#30363d];
}

/* ── Action button ─────────────────────────────────────────── */
.action-btn {
  @apply w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg border border-[#30363d]
         bg-transparent cursor-pointer transition-all duration-150
         hover:bg-white/[0.03];
}

.icon-badge {
  @apply w-7 h-7 rounded-lg border flex items-center justify-center text-[13px] flex-none;
}

.action-label {
  @apply text-[13px] font-medium text-gray-300 group-hover:text-white transition-colors flex-1 text-left;
}

.action-hint {
  @apply text-[10px] text-gray-700 font-mono;
}

/* ── Visitor result animation ──────────────────────────────── */
.result-fade-enter-active,
.result-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.result-fade-enter-from,
.result-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
