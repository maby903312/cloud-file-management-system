<!-- ============================================================
  FileTreeNode.vue — 遞迴檔案樹節點組件
  使用雙 <script> 技巧讓 Vue 3 <script setup> 支援自我參照
 ============================================================ -->
<script lang="ts">
export default { name: 'FileTreeNode' }
</script>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { FileSystemNode } from '@core/composite'
import { Directory, WordFile, ImageFile, TextFile } from '@core/composite'

const props = defineProps<{
  node: FileSystemNode
  selectedNode: FileSystemNode | null
  depth: number
}>()

const emit = defineEmits<{
  select: [node: FileSystemNode]
}>()

const isExpanded = ref(true)
const isDir = computed(() => props.node instanceof Directory)
const isSelected = computed(() => props.selectedNode === props.node)

const icon = computed(() => {
  if (props.node instanceof Directory) return isExpanded.value ? '📂' : '📁'
  if (props.node instanceof WordFile) return '📄'
  if (props.node instanceof ImageFile) return '🖼️'
  if (props.node instanceof TextFile) return '📝'
  return '📄'
})

const children = computed(() =>
  props.node instanceof Directory ? props.node.children : []
)

const handleClick = () => {
  if (isDir.value) isExpanded.value = !isExpanded.value
  emit('select', props.node)
}

const TAG_COLORS: Record<string, string> = {
  Urgent: 'text-red-400 bg-red-500/15 border-red-500/30',
  Work:   'text-[#58a6ff] bg-[#58a6ff]/15 border-[#58a6ff]/30',
}
const tagColor = (tag: string) =>
  TAG_COLORS[tag] ?? 'text-purple-400 bg-purple-500/15 border-purple-500/30'
</script>

<template>
  <div>
    <!-- ── Node Row ──────────────────────────────────────────── -->
    <div
      :style="{ paddingLeft: `${depth * 14 + 6}px` }"
      :class="[
        'flex items-center gap-1.5 pr-2 py-[5px] rounded-lg cursor-pointer select-none transition-all duration-150 border',
        isSelected
          ? 'bg-[#58a6ff]/15 border-[#58a6ff]/35 text-[#58a6ff]'
          : 'border-transparent text-gray-400 hover:bg-white/[0.04] hover:text-gray-200',
      ]"
      @click="handleClick"
    >
      <!-- Expand arrow (directories only) -->
      <span class="w-3 text-[10px] flex-none text-center text-gray-600">
        <template v-if="isDir">{{ isExpanded ? '▾' : '▸' }}</template>
      </span>

      <!-- File type icon -->
      <span class="text-[15px] leading-none flex-none">{{ icon }}</span>

      <!-- Node name -->
      <span class="text-[13px] font-medium truncate flex-1 min-w-0">{{ node.name }}</span>

      <!-- Tags badges -->
      <div v-if="node.tags.size > 0" class="flex gap-1 flex-none ml-1">
        <span
          v-for="tag in node.tags"
          :key="tag"
          :class="['text-[10px] font-mono px-1.5 py-px rounded border leading-tight', tagColor(tag)]"
        >{{ tag }}</span>
      </div>
    </div>

    <!-- ── Children (Recursive) ──────────────────────────────── -->
    <Transition name="tree-expand">
      <div v-if="isDir && isExpanded">
        <FileTreeNode
          v-for="child in children"
          :key="child.name"
          :node="child"
          :selectedNode="selectedNode"
          :depth="depth + 1"
          @select="$emit('select', $event)"
        />
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.tree-expand-enter-active,
.tree-expand-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.tree-expand-enter-from,
.tree-expand-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
