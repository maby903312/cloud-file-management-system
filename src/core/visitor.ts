// ============================================================
// Visitor Pattern — 訪問者模式
// ============================================================

import type { Directory, WordFile, ImageFile, TextFile } from './composite'

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
// SearchVisitor：根據副檔名搜尋，回傳符合的節點陣列
// ────────────────────────────────────────────────────────────
import type { FileSystemNode } from './composite'

export class SearchVisitor implements IVisitor {
  private extension: string
  public results: FileSystemNode[] = []

  /**
   * @param extension 副檔名，例如 '.docx'、'.png'
   */
  constructor(extension: string) {
    // 統一加上前綴點，方便比對
    this.extension = extension.startsWith('.')
      ? extension.toLowerCase()
      : '.' + extension.toLowerCase()
    this.results = []
  }

  visitDirectory(node: Directory): FileSystemNode[] {
    console.log('掃描節點: ' + node.name)
    node.children.forEach((child) => child.accept(this))
    return this.results
  }

  private _check(node: FileSystemNode): void {
    console.log('掃描節點: ' + node.name)
    if (node.name.toLowerCase().endsWith(this.extension)) {
      this.results.push(node)
    }
  }

  visitWordFile(node: WordFile): FileSystemNode[] {
    this._check(node)
    return this.results
  }

  visitImageFile(node: ImageFile): FileSystemNode[] {
    this._check(node)
    return this.results
  }

  visitTextFile(node: TextFile): FileSystemNode[] {
    this._check(node)
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
