// ============================================================
// Command Pattern — 命令模式
// ============================================================

import type { FileSystemNode } from './composite'

// ────────────────────────────────────────────────────────────
// ICommand 介面
// ────────────────────────────────────────────────────────────
export interface ICommand {
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
}

// ────────────────────────────────────────────────────────────
// TagCommand：為節點貼上或移除標籤
//   - 備份舊有標籤集合，以供 Undo 完整還原
// ────────────────────────────────────────────────────────────
export class TagCommand implements ICommand {
  private node: FileSystemNode
  private tag: string
  private action: 'add' | 'remove'
  private previousTags: Set<string>

  /**
   * @param node   目標節點
   * @param tag    標籤字串
   * @param action 'add' | 'remove'
   */
  constructor(node: FileSystemNode, tag: string, action: 'add' | 'remove' = 'add') {
    this.node = node
    this.tag = tag
    this.action = action
    // 備份舊標籤（深拷貝）
    this.previousTags = new Set(node.tags)
  }

  execute(): void {
    console.log(`[Command] 執行... ${this.action === 'add' ? '新增' : '移除'} 標籤「${this.tag}」於「${this.node.name}」`)
    if (this.action === 'add') {
      this.node.tags.add(this.tag)
    } else {
      this.node.tags.delete(this.tag)
    }
  }

  undo(): void {
    console.log(`[Undo] 恢復... 還原「${this.node.name}」的標籤至執行前狀態`)
    // 完整還原舊標籤集合
    this.node.tags.clear()
    this.previousTags.forEach((t) => this.node.tags.add(t))
  }
}
