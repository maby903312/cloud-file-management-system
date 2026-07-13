// ============================================================
// Command Pattern — 命令模式
// ============================================================

import type { FileSystemNode } from './composite'

// ────────────────────────────────────────────────────────────
// ICommand 介面
// ────────────────────────────────────────────────────────────
export interface ICommand {
  /** 人可讀命令名稱，用於 UI 顯示 */
  readonly name: string
  execute(): void
  undo(): void
}

// ────────────────────────────────────────────────────────────
// CommandManager：維護 undoStack / redoStack
// ────────────────────────────────────────────────────────────
export class CommandManager {
  private undoStack: ICommand[] = []
  private redoStack: ICommand[] = []

  /** 執行命令並壓入 undoStack，清空 redoStack */
  execute(command: ICommand): void {
    command.execute()
    this.undoStack.push(command)
    this.redoStack = []
  }

  /** 復原上一個命令 */
  undo(): void {
    const command = this.undoStack.pop()
    if (!command) {
      console.log('[Undo] 沒有可復原的命令')
      return
    }
    command.undo()
    this.redoStack.push(command)
  }

  /** 重做上一個被復原的命令 */
  redo(): void {
    const command = this.redoStack.pop()
    if (!command) {
      console.log('[Redo] 沒有可重做的命令')
      return
    }
    command.execute()
    this.undoStack.push(command)
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0
  }

  get undoCount(): number {
    return this.undoStack.length
  }

  get redoCount(): number {
    return this.redoStack.length
  }

  /** 最後一個動作的名稱，給 Undo 按鈕顯示用 */
  get lastCommandName(): string {
    if (this.undoStack.length === 0) return ''
    return this.undoStack[this.undoStack.length - 1].name
  }
}

// ────────────────────────────────────────────────────────────────
// TagCommand：為節點貼上或移除標簽（支援 Toggle）
//   - 構造時自動判斷節點是否已有該標簽：
//     有 → 移除，無 → 新增
//   - 備份舊標簽集合，以供 Undo 完整還原
// ────────────────────────────────────────────────────────────────
export class TagCommand implements ICommand {
  private node: FileSystemNode
  private tag: string
  private action: 'add' | 'remove'
  private previousTags: Set<string>
  readonly name: string

  /**
   * @param node 目標節點
   * @param tag  標簽字串
   *
   * action 由構造式自動判斷：
   *   節點已有該標簽 → remove，否則 → add
   */
  constructor(node: FileSystemNode, tag: string) {
    this.node = node
    this.tag = tag
    this.action = node.tags.has(tag) ? 'remove' : 'add'
    this.name = this.action === 'add' ? `標記 ${tag}` : `移除 ${tag}`
    // 備份舊標簽（深拷貝）
    this.previousTags = new Set(node.tags)
  }

  execute(): void {
    console.log(`[Command] 執行... ${this.action === 'add' ? '新增' : '移除'} 標簽「${this.tag}」於「${this.node.name}」`)
    if (this.action === 'add') {
      this.node.tags.add(this.tag)
    } else {
      this.node.tags.delete(this.tag)
    }
  }

  undo(): void {
    console.log(`[Undo] 恢復... 還原「${this.node.name}」的標簽至執行前狀態`)
    // 完整還原舊標簽集合
    this.node.tags.clear()
    this.previousTags.forEach((t) => this.node.tags.add(t))
  }
}
