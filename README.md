# 雲端檔案管理系統

> **Cloud File Management System** — 雲端檔案管理 Web 應用程式

## 啟動方式

```bash
npm install
npm run dev:ui   # 啟動前端開發伺服器，預設在 http://localhost:5173
```

---

## 📋 程式概述

本系統模擬一個雲端硬碟的核心功能，支援多種檔案類型（Word、圖片、純文字）以及資料夾的巢狀結構。使用者可透過視覺化 Web UI 對檔案系統執行以下操作：

- 📂 **瀏覽**：展開 / 收合多層巢狀目錄，點擊節點查看詳細資訊與完整路徑
- 📦 **容量計算**：遞迴統計整棵樹或指定節點以下的總容量（KB / MB）
- 🔍 **關鍵字搜尋**：模糊比對檔名或副檔名，支援無限深度遞迴
- 📝 **XML 匯出**：將目錄樹序列化為自訂格式的 XML 字串
- 🏷️ **標籤管理**：對節點貼上 / 移除 Urgent、Work、Personal 標籤
- 🗑️ **刪除 / 複製 / 貼上**：支援完整的剪貼簿操作
- ↩️ **Undo / Redo**：無限步驟的歷史操作記錄與還原

---

## 🏗️ 系統架構

```
cloud-file-management-system/
├── src/
│   ├── core/             # 純 TypeScript 核心業務邏輯（不含任何 UI 程式碼）
│   │   ├── composite.ts  # Composite Pattern — 檔案系統節點結構
│   │   ├── visitor.ts    # Visitor Pattern  — 遍歷演算法
│   │   ├── command.ts    # Command Pattern  — 操作封裝與 Undo/Redo
│   │   └── index.ts      # 初始化根目錄與預設資料
│   └── ui/
│       ├── App.vue           # 主畫面（Vue 3 Composition API）
│       └── components/
│           └── FileTreeNode.vue  # 遞迴樹節點元件
├── index.html
├── vite.config.ts
└── tailwind.config.js
```

### 分層原則

| 層次                     | 職責                             | 約束                                   |
| ------------------------ | -------------------------------- | -------------------------------------- |
| **核心層** (`src/core/`) | 業務邏輯、資料結構、設計模式實作 | 嚴禁出現任何 Vue / DOM 程式碼          |
| **UI 層** (`src/ui/`)    | 畫面渲染、使用者互動、響應式狀態 | 只能 `import` 核心類別，不可修改其實作 |

---

## 🎨 使用的 Design Patterns

### 1. Composite Pattern（組合模式）

**目的**：讓單一檔案與資料夾（可包含子節點的容器）能以相同的介面操作，統一表示「部分—整體」的樹狀階層結構。

**實作位置**：[`src/core/composite.ts`](src/core/composite.ts)

**類別關係**：

```
FileSystemNode（抽象基底）
├── Directory（容器節點）     → 可包含任意數量的子 FileSystemNode
└── File（葉節點基底）
    ├── WordFile  (.docx)    → 額外屬性：pages（頁數）
    ├── ImageFile (.png/jpg) → 額外屬性：width × height（解析度）
    └── TextFile  (.txt)     → 額外屬性：encoding（編碼格式）
```

**關鍵設計決策**：

- `FileSystemNode` 宣告抽象方法 `accept(visitor)` 與 `clone()`，確保每種節點都能被 Visitor 遍歷及深拷貝
- `Directory.add()` 在加入子節點時自動設定 `child.parent = this`，使 `getPath()` 能遞迴往上追溯出完整路徑（如 `Root/專案文件/需求規格書.docx`）
- `clone()` 在 `Directory` 中遞迴深拷貝所有子節點，確保貼上操作（`PasteCommand`）不共享原始節點的引用

**使用效果**：

```typescript
// 不論是目錄或任何檔案，都可以用同一行程式碼計算容量
const size = node.accept(new SizeVisitor());
```

---

### 2. Visitor Pattern（訪問者模式）

**目的**：將「對節點的操作演算法」從節點本身分離。新增一種遍歷邏輯時，無需修改任何節點類別，只需新增一個 Visitor 實作。

**實作位置**：[`src/core/visitor.ts`](src/core/visitor.ts)

**IVisitor 介面**：

```typescript
interface IVisitor {
  visitDirectory(node: Directory): unknown;
  visitWordFile(node: WordFile): unknown;
  visitImageFile(node: ImageFile): unknown;
  visitTextFile(node: TextFile): unknown;
}
```

**三種內建 Visitor 操作**：

| Visitor            | 功能                                                   | 回傳值                                      |
| ------------------ | ------------------------------------------------------ | ------------------------------------------- |
| `SizeVisitor`      | 遞迴加總所有葉節點的 `size`，計算總容量                | `number`（KB）                              |
| `SearchVisitor`    | 以 `name.includes(keyword)` 模糊比對，收集所有符合節點 | 透過 `getResults()` 取得 `FileSystemNode[]` |
| `XmlExportVisitor` | 遞迴序列化整棵樹為縮排 XML 字串                        | `string`                                    |

**雙重分派（Double Dispatch）機制**：

```
UI 呼叫 node.accept(visitor)
  ↓ 節點自行呼叫對應的 visit 方法
visitor.visitDirectory(this)   ← Directory
visitor.visitWordFile(this)    ← WordFile
visitor.visitImageFile(this)   ← ImageFile
```

這讓 Visitor 能在不使用 `instanceof` 判斷的情況下，根據節點的實際型別分發至正確的處理方法。

---

### 3. Command Pattern（命令模式）

**目的**：將使用者的「操作」封裝為物件，使其可被記錄、撤銷（Undo）與重做（Redo）。

**實作位置**：[`src/core/command.ts`](src/core/command.ts)

**ICommand 介面**：

```typescript
interface ICommand {
  readonly name: string; // 人可讀名稱，用於 UI 的 Undo 按鈕顯示
  execute(): void;
  undo(): void;
}
```

**三種具體命令**：

| Command         | 操作                                | Undo 機制                                                           |
| --------------- | ----------------------------------- | ------------------------------------------------------------------- |
| `TagCommand`    | 對節點新增或移除標籤（Toggle）      | 備份舊標籤集合（`Set<string>` 深拷貝），Undo 時完整還原             |
| `DeleteCommand` | 從父目錄移除節點                    | 記住節點在 `children` 陣列中的原始索引，Undo 時以 `splice` 插回原位 |
| `PasteCommand`  | 將來源節點 `clone()` 後加入目標目錄 | Undo 時從目標目錄移除剛貼入的 clone                                 |

**CommandManager（Invoker）**：

```
execute(cmd) → cmd.execute() → 推入 undoStack，清空 redoStack
undo()       → 從 undoStack pop → cmd.undo() → 推入 redoStack
redo()       → 從 redoStack pop → cmd.execute() → 推入 undoStack
```

- `canUndo` / `canRedo` getter 控制按鈕的 disabled 狀態
- `lastCommandName` / `lastRedoName` getter 讓按鈕能即時顯示將要復原的操作名稱

---

## 🔗 模式間的協作關係

```
Composite ←──── Visitor
    │              │
    │         accept(visitor) 觸發雙重分派
    │
    └──── Command
              │
         記錄對 Composite 節點的操作
         以支援 Undo / Redo
```

- **Composite** 提供統一的樹狀資料結構
- **Visitor** 在不修改結構的前提下，新增各種遍歷演算法
- **Command** 將對結構的修改封裝成可復原的操作物件

---

## 🛠️ 前端技術棧

| 技術         | 版本 | 用途                                           |
| ------------ | ---- | ---------------------------------------------- |
| Vue 3        | ^3.x | 前端框架（Composition API + `<script setup>`） |
| TypeScript   | ^5.x | 靜態型別，與核心層共用型別定義                 |
| Vite         | ^5.x | 開發伺服器與建置工具                           |
| Tailwind CSS | ^3.x | 原子化 CSS，暗色系 UI 設計                     |

### 響應式陷阱與解法

核心層使用純 TypeScript Class（OOP），Vue 的 `reactive()` 代理（Proxy）會干擾 Class instance 的 `this` 綁定與 prototype chain。

**解法**：使用 `shallowRef` 包裹 Class instance，並在每次 Command 執行後手動遞增 `updateKey`（`forceUpdate()`），強制 Vue 重新渲染，避免深層代理破壞 OOP 行為。
