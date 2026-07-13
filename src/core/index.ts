// ============================================================
// src/core/index.ts — Console 版測試進入點
// 建立規定的目錄結構，並執行三大 Visitor + Command 示範
// ============================================================

import { Directory, WordFile, ImageFile, TextFile } from './composite'
import {
  SizeVisitor,
  SearchVisitor,
  XmlExportVisitor,
} from './visitor'
import { CommandManager, TagCommand } from './command'

// ────────────────────────────────────────────────────────────
// 建立初始檔案系統結構（嚴格依照規格）
// ────────────────────────────────────────────────────────────
export const root = new Directory('Root')

// 專案文件_Project_Docs
const projectDocs = new Directory('專案文件_Project_Docs')
const specDoc = new WordFile('需求規格書.docx', 500, 15)
const archDiagram = new ImageFile('系統架構圖.png', 2048, 1920, 1080)
projectDocs.add(specDoc).add(archDiagram)

// 個人筆記_Personal_Notes
const personalNotes = new Directory('個人筆記_Personal_Notes')
const todoList = new TextFile('待辦清單.txt', 1, 'UTF-8')
const archive2025 = new Directory('Archive_2025')
const oldMeeting = new WordFile('舊會議記錄.docx', 200, 5)
archive2025.add(oldMeeting)
personalNotes.add(todoList).add(archive2025)

// README.txt（Root 直屬）
const readme = new TextFile('README.txt', 1, 'ASCII')

// 組裝 Root
root.add(projectDocs).add(personalNotes).add(readme)

// ────────────────────────────────────────────────────────────
// 匯出給 Vue UI 使用的 CommandManager
// ────────────────────────────────────────────────────────────
export const commandManager = new CommandManager()

// ────────────────────────────────────────────────────────────
// Console 測試（僅在直接以 ts-node 執行時才跑）
// ────────────────────────────────────────────────────────────
function runConsoleDemo(): void {
  console.log('='.repeat(60))
  console.log('  雲端檔案管理系統 — Console Demo')
  console.log('='.repeat(60))

  // ── SizeVisitor ──────────────────────────────────────────
  console.log('\n【1. SizeVisitor：計算總容量】')
  const sizeVisitor = new SizeVisitor()
  const totalSize = root.accept(sizeVisitor) as number
  console.log(`\n▶ 總容量：${totalSize} KB`)

  // ── SearchVisitor ─────────────────────────────────────────
  console.log('\n【2. SearchVisitor：搜尋 .docx 檔案】')
  const searchVisitor = new SearchVisitor('.docx')
  root.accept(searchVisitor)
  console.log(`\n▶ 找到 ${searchVisitor.results.length} 個 .docx 檔案：`)
  searchVisitor.results.forEach((f) => console.log('  -', f.name))

  // ── XmlExportVisitor ──────────────────────────────────────
  console.log('\n【3. XmlExportVisitor：匯出 XML】')
  const xmlVisitor = new XmlExportVisitor()
  const xml = root.accept(xmlVisitor) as string
  console.log('\n' + xml)

  // ── CommandManager + TagCommand ───────────────────────────
  console.log('\n【4. Command Pattern：標籤操作與 Undo】')
  const cmd1 = new TagCommand(specDoc, 'Urgent')
  const cmd2 = new TagCommand(specDoc, 'Work')

  commandManager.execute(cmd1)
  console.log('  需求規格書 tags:', [...specDoc.tags])

  commandManager.execute(cmd2)
  console.log('  需求規格書 tags:', [...specDoc.tags])

  commandManager.undo()
  console.log('  Undo 後 tags:', [...specDoc.tags])

  commandManager.undo()
  console.log('  Undo 後 tags:', [...specDoc.tags])

  console.log('\n' + '='.repeat(60))
  console.log('  Demo 結束')
  console.log('='.repeat(60))
}

// 只有被 ts-node 直接執行時才啟動 demo
// ESM 環境下以 import.meta.url 判斷主模組
// ts-node 執行時 process.argv[1] 會帶有本檔路徑
const isMain =
  typeof process !== 'undefined' &&
  process.argv[1] != null &&
  process.argv[1].replace(/\\/g, '/').endsWith('src/core/index.ts')

if (isMain) {
  runConsoleDemo()
}
