<script setup lang="ts">
import {
  currentModel,
  useConfig,
  baseUrl,
  gravatarEmail,
  togglePanel,
} from '../services/appConfig.ts'
import TextInput from './Inputs/TextInput.vue'
import { onMounted, ref } from 'vue'
import ModelSelector from './ModelSelector.vue'
import { IconX } from '@tabler/icons-vue'

const { initializeConfig } = useConfig()
const configInput = ref('')
const defaultConfigInput = ref('')

onMounted(() => {
  initialize()
})

const initialize = () => {
  initializeConfig(currentModel.value).then(function (configs) {
    configInput.value = configs?.modelConfig?.systemPrompt ?? ''
    defaultConfigInput.value = configs?.defaultConfig?.systemPrompt ?? ''
  })
}
</script>

<template>
  <aside class="flex h-screen flex-col gap-6">
    <div
      class="flex w-full flex-row items-center justify-center gap-4 rounded-b-xl bg-gray-100 px-4 py-2 dark:bg-gray-800"
    >
      <div class="mr-auto flex h-full items-center">
        <div>
          <span
            class="block h-full rounded border-none p-2 text-lg font-medium text-gray-900 dark:text-gray-100"
          >
            All Settings
          </span>
        </div>
      </div>
      <ModelSelector :disabled="false" @change="initialize" />
    </div>

    <div
      class="relative flex h-screen w-full flex-col overflow-y-auto border-gray-200 bg-white py-4 text-white dark:border-gray-700 dark:bg-gray-900"
    >
      <button
        @click="togglePanel('allSettings')"
        class="absolute right-0 top-0 text-white bg-gray-700 rounded p-1"
      >
        <IconX class="h-6 w-6" />
      </button>

      <TextInput id="base-url" label="Base URL" v-model="baseUrl" />

      <TextInput id="gravatar-email" label="Gravatar Email" v-model="gravatarEmail" />
    </div>
  </aside>
</template>
