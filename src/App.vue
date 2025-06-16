<script setup lang="ts">
import Sidebar from './components/Sidebar.vue'
import ChatInput from './components/ChatInput.vue'
import ChatMessages from './components/ChatMessages.vue'
import SystemPrompt from './components/SystemPrompt.vue'
import ModelSelector from './components/ModelSelector.vue'
import {
  currentModel,
  isDarkMode,
  isSettingsOpen,
  isSystemPromptOpen,
  isAllSettingsOpen,
} from './services/appConfig.ts'
import { nextTick, onMounted, ref } from 'vue'
import { useChats } from './services/chat.ts'
import TextInput from './components/Inputs/TextInput.vue'
import Settings from './components/Settings.vue'
import { Ollama } from 'ollama/dist/browser.mjs'

const ollama = new Ollama()

async function checkOllama() {
  try {
    const models = await ollama.list()
    return models.models.length > 0
  } catch (error) {
    return false
  }
}

const {
  availableModels,
  activeChat,
  renameChat,
  switchModel,
  initialize,
  refreshModels,
} = useChats()
const isEditingChatName = ref(false)
const editedChatName = ref('')
const chatNameInput = ref()
const ollamaAvailable = ref(true)

const startEditing = () => {
  isEditingChatName.value = true
  editedChatName.value = activeChat.value?.name || ''
  nextTick(() => {
    if (!chatNameInput.value) return
    const input = chatNameInput.value.$el.querySelector('input')
    input.focus()
    input.select()
  })
}

const cancelEditing = () => {
  isEditingChatName.value = false
  editedChatName.value = ''
}

const confirmRename = () => {
  if (activeChat.value && editedChatName.value) {
    renameChat(editedChatName.value)
    isEditingChatName.value = false
  }
}

onMounted(async () => {
  await initialize()
  ollamaAvailable.value = await checkOllama()
  if (ollamaAvailable.value) {
    await refreshModels()
    await switchModel(currentModel.value ?? availableModels.value[0].name)
  }
})
</script>

<template>
  <div :class="{ dark: isDarkMode }">
    <main
      class="flex h-full w-full flex-1 flex-row items-stretch bg-white dark:bg-gray-900"
    >
      <Sidebar />

      <div class="mx-auto flex h-screen w-full flex-col">
        <div
          v-if="isSystemPromptOpen"
          class="mx-auto flex h-screen w-full max-w-7xl flex-col gap-4 px-4 pb-4"
        >
          <SystemPrompt />
        </div>

		<div
          v-if="isAllSettingsOpen"
          class="mx-auto flex h-screen w-full max-w-7xl flex-col gap-4 px-4 pb-4"
        >
          <AllSettings />
        </div>

        <div
          v-if="!isSystemPromptOpen"
          class="mx-auto flex h-screen w-full max-w-7xl flex-col gap-4 px-4 pb-4"
        >
          <div
            class="flex w-full flex-row items-center justify-center gap-4 rounded-b-xl bg-gray-100 px-4 py-2 dark:bg-gray-800"
          >
            <div class="mr-auto flex h-full items-center" v-if="activeChat">
              <div>
                <div v-if="isEditingChatName">
                  <TextInput
                    id="chat-name"
                    v-model="editedChatName"
                    ref="chatNameInput"
                    @keyup.enter="confirmRename"
                    @keyup.esc="cancelEditing"
                    @blur="cancelEditing"
                  />
                </div>

                <button
                  type="button"
                  class="block h-full rounded border-none p-2 text-gray-900 decoration-gray-400 decoration-dashed outline-none hover:underline focus:ring-2 focus:ring-blue-600 dark:text-gray-100 dark:focus:ring-blue-600"
                  v-else
                  @click.prevent="startEditing"
                >
                  {{ activeChat.name }}
                </button>
              </div>
            </div>

            <ModelSelector />
          </div>

          <ChatMessages />
          <ChatInput />
        </div>
      </div>

      <transition name="slide">
        <Settings v-if="isSettingsOpen" />
      </transition>
    </main>

    <!-- Ollama Not Available Popup -->
    <div
      v-if="!ollamaAvailable"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
    >
      <div class="rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
        <h2 class="mb-4 text-xl font-bold text-gray-900 dark:text-white">
          Ollama Not Available
        </h2>
        <p class="mb-4 text-gray-600 dark:text-gray-300">
          Please make sure Ollama is running on your system. You can start it by running:
        </p>
        <code
          class="mb-4 block rounded bg-gray-100 p-2 font-mono text-sm dark:bg-gray-700 dark:text-gray-200"
        >
          ollama serve
        </code>
        <button
          @click="
            async () => {
              ollamaAvailable = await checkOllama()
            }
          "
          class="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Retry Connection
        </button>
      </div>
    </div>
  </div>
</template>
