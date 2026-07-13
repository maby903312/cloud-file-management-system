// ============================================================
// Composite Pattern — 組合模式
// 嚴禁出現任何 Vue 或 DOM 相關程式碼
// ============================================================

import type { IVisitor } from './visitor'

// ────────────────────────────────────────────────────────────
// 抽象基底類別：FileSystemNode
// ────────────────────────────────────────────────────────────
export abstract class FileSystemNode {
  public name: string
  public size: number          // 單位：KB
  public createdAt: Date
  public tags: Set<string>
  /** 指向父目錄，根節點為 null */
  public parent: Directory | null = null

  constructor(name: string, size: number, createdAt?: Date) {
    this.name = name
    this.size = size
    this.createdAt = createdAt ?? new Date()
    this.tags = new Set<string>()
  }

  /**
   * 遞迴往上追溯 parent，組合完整絕對路徑。
   * 例如：Root/專案文件_Project_Docs/需求規格書.docx
   */
  getPath(): string {
    if (this.parent === null) return this.name
    return `${this.parent.getPath()}/${this.name}`
  }

  /** 接受訪問者（Visitor Pattern 的 accept 鉤子） */
  abstract accept(visitor: IVisitor): unknown

  /** 深拷貝自身，回傳一個全新節點（parent 不被拷貝） */
  abstract clone(): FileSystemNode
}

// ────────────────────────────────────────────────────────────
// 具體類別：Directory（葉節點的容器）
// ────────────────────────────────────────────────────────────
export class Directory extends FileSystemNode {
  public children: FileSystemNode[]

  constructor(name: string, createdAt?: Date) {
    super(name, 0, createdAt)
    this.children = []
  }

  /** 加入子節點，並自動設定 parent 回指 */
  add(node: FileSystemNode): this {
    node.parent = this
    this.children.push(node)
    return this
  }

  /** 移除子節點 */
  remove(node: FileSystemNode): void {
    const idx = this.children.indexOf(node)
    if (idx !== -1) this.children.splice(idx, 1)
  }

  /** 取得所有子節點（供 Visitor 遍歷使用） */
  getChildren(): FileSystemNode[] {
    return this.children
  }

  accept(visitor: IVisitor): unknown {
    return visitor.visitDirectory(this)
  }

  /**
   * 深拷貝目錄：遞迴 clone 所有子節點，并重新設定 parent
   * 結果的 parent 為 null（待貼上動作內再更新）
   */
  clone(): Directory {
    const copy = new Directory(this.name, new Date(this.createdAt))
    copy.tags = new Set(this.tags)
    for (const child of this.children) {
      copy.add(child.clone()) // add() 自動設 parent
    }
    return copy
  }
}

// ────────────────────────────────────────────────────────────
// 具體類別：File（葉節點基底）
// ────────────────────────────────────────────────────────────
export abstract class File extends FileSystemNode {
  constructor(name: string, size: number, createdAt?: Date) {
    super(name, size, createdAt)
  }
}

// ────────────────────────────────────────────────────────────
// 具體檔案類別
// ────────────────────────────────────────────────────────────

/** Word 文件（.docx） */
export class WordFile extends File {
  public pages: number

  constructor(name: string, size: number, pages: number, createdAt?: Date) {
    super(name, size, createdAt)
    this.pages = pages
  }

  accept(visitor: IVisitor): unknown {
    return visitor.visitWordFile(this)
  }

  clone(): WordFile {
    const copy = new WordFile(this.name, this.size, this.pages, new Date(this.createdAt))
    copy.tags = new Set(this.tags)
    return copy
  }
}

/** 圖片檔案（.png / .jpg 等） */
export class ImageFile extends File {
  public width: number
  public height: number

  constructor(
    name: string,
    size: number,
    width: number,
    height: number,
    createdAt?: Date,
  ) {
    super(name, size, createdAt)
    this.width = width
    this.height = height
  }

  accept(visitor: IVisitor): unknown {
    return visitor.visitImageFile(this)
  }

  clone(): ImageFile {
    const copy = new ImageFile(this.name, this.size, this.width, this.height, new Date(this.createdAt))
    copy.tags = new Set(this.tags)
    return copy
  }
}

/** 純文字檔案（.txt） */
export class TextFile extends File {
  public encoding: string

  constructor(
    name: string,
    size: number,
    encoding: string,
    createdAt?: Date,
  ) {
    super(name, size, createdAt)
    this.encoding = encoding
  }

  accept(visitor: IVisitor): unknown {
    return visitor.visitTextFile(this)
  }

  clone(): TextFile {
    const copy = new TextFile(this.name, this.size, this.encoding, new Date(this.createdAt))
    copy.tags = new Set(this.tags)
    return copy
  }
}
