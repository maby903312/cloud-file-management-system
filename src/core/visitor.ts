// ============================================================
// Visitor Pattern — 訪問者模式
// ============================================================

import type { FileSystemNode, Directory, WordFile, ImageFile, TextFile } from './composite'

// ────────────────────────────────────────────────────────────
// IVisitor 介面
// ────────────────────────────────────────────────────────────
export interface IVisitor {
  visitDirectory(node: Directory): unknown
  visitWordFile(node: WordFile): unknown
  visitImageFile(node: ImageFile): unknown
  visitTextFile(node: TextFile): unknown
}

// ────────────────────────────────────────────────────────────
// SizeVisitor：遞迴計算總容量（KB）
// ────────────────────────────────────────────────────────────
export class SizeVisitor implements IVisitor {
  visitDirectory(node: Directory): number {
    console.log('掃描節點: ' + node.name)
    return node.children.reduce(
      (total, child) => total + (child.accept(this) as number),
      0,
    )
  }

  visitWordFile(node: WordFile): number {
    console.log('掃描節點: ' + node.name)
    return node.size
  }

  visitImageFile(node: ImageFile): number {
    console.log('掃描節點: ' + node.name)
    return node.size
  }

  visitTextFile(node: TextFile): number {
    console.log('掃描節點: ' + node.name)
    return node.size
  }
}

// ────────────────────────────────────────────────────────────
// SearchVisitor：根據關鍵字搜尋，支援無限層級遞迴
//
// 【修復說明】
//   舊版使用 extension.endsWith() 做尾綴精確比對，且回傳值
//   設計讓人誤解遞迴是否正確觸發。
//   新版：
//   1. constructor 接收 keyword（關鍵字，不限格式）
//   2. visitDirectory：先比對目錄名稱，再用 getChildren()
//      對每個 child 呼叫 child.accept(this) → 真正的深層遞迴
//   3. 各 visitXxxFile：用 name.includes(keyword) 模糊比對
//   4. 結果由 private results 統一收集，對外只開 getResults()
// ────────────────────────────────────────────────────────────
export class SearchVisitor implements IVisitor {
  private keyword: string
  private results: FileSystemNode[] = []

  /**
   * @param keyword 搜尋關鍵字（大小寫不敏感）
   *                可傳完整檔名、副檔名（如 ".docx"）或任意片段
   */
  constructor(keyword: string) {
    // 統一轉小寫，避免大小寫差異造成漏搜
    this.keyword = keyword.toLowerCase()
    this.results = []
  }

  // ── 目錄節點：關鍵邏輯 ────────────────────────────────────
  // 1. 比對目錄本身的名稱
  // 2. 用迴圈遍歷所有 children，每個都呼叫 child.accept(this)
  //    → Visitor 鑽進下一層，達成無限深度遞迴
  visitDirectory(directory: Directory): void {
    console.log('掃描節點: ' + directory.name)
    // 1. 目錄名稱比對
    if (directory.name.toLowerCase().includes(this.keyword)) {
      this.results.push(directory)
    }
    // 2. 遞迴進入所有子節點（關鍵！缺少這步會造成遞迴中斷）
    for (const child of directory.getChildren()) {
      child.accept(this)
    }
  }

  // ── 檔案節點：name.includes(keyword) 模糊比對 ────────────
  visitWordFile(file: WordFile): void {
    console.log('掃描節點: ' + file.name)
    if (file.name.toLowerCase().includes(this.keyword)) {
      this.results.push(file)
    }
  }

  visitImageFile(file: ImageFile): void {
    console.log('掃描節點: ' + file.name)
    if (file.name.toLowerCase().includes(this.keyword)) {
      this.results.push(file)
    }
  }

  visitTextFile(file: TextFile): void {
    console.log('掃描節點: ' + file.name)
    if (file.name.toLowerCase().includes(this.keyword)) {
      this.results.push(file)
    }
  }

  /** 取回所有符合的節點（遍歷結束後呼叫） */
  getResults(): FileSystemNode[] {
    return this.results
  }
}

// ────────────────────────────────────────────────────────────
// XmlExportVisitor：匯出自訂格式 XML
//   目錄  → <目錄名稱>…子節點…</目錄名稱>
//   檔案  → <檔名_附檔名>屬性摘要</檔名_附檔名>
//   例如  → <需求規格書_docx>頁數: 15, 大小: 500</需求規格書_docx>
// ────────────────────────────────────────────────────────────
export class XmlExportVisitor implements IVisitor {
  private indent: number

  constructor(indent = 0) {
    this.indent = indent
  }

  private pad(): string {
    return '  '.repeat(this.indent)
  }

  /** 將 "需求規格書.docx" → "需求規格書_docx" */
  private tagName(filename: string): string {
    const dotIdx = filename.lastIndexOf('.')
    if (dotIdx === -1) return filename
    const base = filename.slice(0, dotIdx)
    const ext = filename.slice(dotIdx + 1)
    return `${base}_${ext}`
  }

  visitDirectory(node: Directory): string {
    console.log('掃描節點: ' + node.name)
    const childVisitor = new XmlExportVisitor(this.indent + 1)
    const childXml = node.children
      .map((child) => child.accept(childVisitor) as string)
      .join('\n')
    const open = `${this.pad()}<${node.name}>`
    const close = `${this.pad()}</${node.name}>`
    return childXml ? `${open}\n${childXml}\n${close}` : `${open}${close}`
  }

  visitWordFile(node: WordFile): string {
    console.log('掃描節點: ' + node.name)
    const tag = this.tagName(node.name)
    const attrs = `頁數: ${node.pages}, 大小: ${node.size}`
    return `${this.pad()}<${tag}>${attrs}</${tag}>`
  }

  visitImageFile(node: ImageFile): string {
    console.log('掃描節點: ' + node.name)
    const tag = this.tagName(node.name)
    const attrs = `解析度: ${node.width}x${node.height}, 大小: ${node.size}`
    return `${this.pad()}<${tag}>${attrs}</${tag}>`
  }

  visitTextFile(node: TextFile): string {
    console.log('掃描節點: ' + node.name)
    const tag = this.tagName(node.name)
    const attrs = `編碼: ${node.encoding}, 大小: ${node.size}`
    return `${this.pad()}<${tag}>${attrs}</${tag}>`
  }
}
