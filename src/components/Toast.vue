<script setup lang="ts">
import { ref, onMounted } from 'vue'

const props = defineProps<{
  message: string
  duration?: number
  status?: 'success' | 'failure'
}>()

const isVisible = ref(true)

onMounted(() => {
  if (props.duration) {
    setTimeout(() => {
      isVisible.value = false
    }, props.duration)
  }
})
</script>

<template>
  <Transition
    enter-active-class="transition duration-300 ease-out"
    enter-from-class="transform translate-y-2 opacity-0"
    enter-to-class="transform translate-y-0 opacity-100"
    leave-active-class="transition duration-200 ease-in"
    leave-from-class="transform translate-y-0 opacity-100"
    leave-to-class="transform translate-y-2 opacity-0"
  >
    <div
      v-if="isVisible"
      class="fixed top-4 right-4 z-50 rounded-lg px-6 py-2 text-xl font-medium text-white shadow-sm"
      :class="{
        'bg-green-600 dark:bg-green-700 shadow-lime-300': status === 'success',
        'bg-red-600 dark:bg-red-700 shadow-red-300': status === 'failure',
        'bg-gray-900 dark:bg-gray-700 shadow-gray-300': !status
      }"
    >
      {{ message }}
    </div>
  </Transition>
</template> 