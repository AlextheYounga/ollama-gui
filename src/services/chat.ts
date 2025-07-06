import { computed, ref } from 'vue'
import { Chat, db, Message } from './database'
import { historyMessageLength, currentModel, useConfig } from './appConfig'
import { Ollama, ModelResponse } from 'ollama/dist/browser.mjs'

const ollama = new Ollama()

interface ChatExport extends Chat {
  messages: Message[]
}

// State
const availableModels = ref<ModelResponse[]>([])
const chats = ref<Chat[]>([])
const activeChat = ref<Chat | null>(null)
const messages = ref<Message[]>([])
const systemPrompt = ref<Message>()
const ongoingAiMessages = ref<Map<number, Message>>(new Map())

// Database Layer
const dbLayer = {
  async getAllChats() {
    return db.chats.toArray()
  },

  async getChat(chatId: number) {
    return db.chats.get(chatId)
  },

  async getMessages(chatId: number) {
    return db.messages.where('chatId').equals(chatId).toArray()
  },

  async addChat(chat: Chat) {
    return db.chats.add(chat)
  },

  async updateChat(chatId: number, updates: Partial<Chat>) {
    return db.chats.update(chatId, updates)
  },

  async addMessage(message: Message) {
    return db.messages.add(message)
  },

  async updateMessage(messageId: number, updates: Partial<Message>) {
    return db.messages.update(messageId, updates)
  },

  async deleteChat(chatId: number) {
    return db.chats.delete(chatId)
  },

  async deleteMessagesOfChat(chatId: number) {
    return db.messages.where('chatId').equals(chatId).delete()
  },

  async deleteMessage(messageId: number) {
    return db.messages.delete(messageId)
  },

  async clearChats() {
    return db.chats.clear()
  },

  async clearMessages() {
    return db.messages.clear()
  },
}

export const refreshModels = async () => {
	try {
		const models = await ollama.list()
		availableModels.value = models.models
	} catch (error) {
		console.log('Failed to refresh models:', error)
	}
}

export function useChats() {
  // Computed
  const sortedChats = computed<Chat[]>(() =>
    [...chats.value].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
  )
  const hasActiveChat = computed(() => activeChat.value !== null)
  const hasMessages = computed(() => messages.value.length > 0)

  // Methods for state mutations
  const setActiveChat = (chat: Chat) => (activeChat.value = chat)
  const setMessages = (newMessages: Message[]) => (messages.value = newMessages)

  const initialize = async () => {
    try {
      chats.value = await dbLayer.getAllChats()
      if (chats.value.length > 0) {
        await switchChat(sortedChats.value[0].id!)
      } else {
        await startNewChat('New chat')
      }
    } catch (error) {
      console.error('Failed to initialize chats:', error)
    }
  }

  const switchChat = async (chatId: number) => {
    try {
      const chat = await dbLayer.getChat(chatId)
      if (chat) {
        setActiveChat(chat)
        const chatMessages = await dbLayer.getMessages(chatId)
        setMessages(chatMessages)
        if (activeChat.value) {
          await switchModel(activeChat.value.model)
        }
      }
    } catch (error) {
      console.error(`Failed to switch to chat with ID ${chatId}:`, error)
    }
  }

  const switchModel = async (model: string) => {
    currentModel.value = model
    if (!activeChat.value) return

    try {
      await dbLayer.updateChat(activeChat.value.id!, { model })
      activeChat.value.model = model
    } catch (error) {
      console.error(`Failed to switch model to ${model}:`, error)
    }
  }

  const renameChat = async (newName: string) => {
    if (!activeChat.value) return

    activeChat.value.name = newName
    await dbLayer.updateChat(activeChat.value.id!, { name: newName })
    chats.value = await dbLayer.getAllChats()
  }

  const startNewChat = async (name: string) => {
    const newChat: Chat = {
      name,
      model: currentModel.value,
      createdAt: new Date(),
    }

    try {
      newChat.id = await dbLayer.addChat(newChat)
      chats.value.push(newChat)
      setActiveChat(newChat)
      setMessages([])
      await addSystemMessage(await useConfig().getCurrentSystemMessage())
    } catch (error) {
      console.error('Failed to start a new chat:', error)
    }
  }

  const addSystemMessage = async (content: string | null, meta?: any) => {
    if (!activeChat.value) return
    if (!content) return

    const systemPromptMessage: Message = {
      chatId: activeChat.value.id!,
      role: 'system',
      content,
      meta,
      createdAt: new Date(),
    }

    systemPromptMessage.id = await dbLayer.addMessage(systemPromptMessage)
    messages.value.push(systemPromptMessage)

    systemPrompt.value = systemPromptMessage
  }

  /*
   * addUserMessage handles adding a user message and generating an AI response:
   * 1. Creates and saves a new user message with the provided content
   * 2. Creates an empty AI message to stream the response into
   * 3. Calls generate() to stream the AI response, which:
   *    - Appends new content to the AI message as it arrives
   *    - Updates the message in the database
   *    - Updates the UI if this is still the active chat
   *    - Cleans up the ongoing message tracking when complete
   * The function requires an active chat and handles the full lifecycle
   * of the message exchange between user and AI.
   */
  const addUserMessage = async (content: string) => {
    if (!activeChat.value) {
      console.warn('There was no active chat.')
      return
    }

    const currentChatId = activeChat.value.id!
    const message: Message = {
      chatId: activeChat.value.id!,
      role: 'user',
      content,
      createdAt: new Date(),
    }

    try {
      message.id = await dbLayer.addMessage(message)
      messages.value.push(message)

      // Start a new AI message
      const aiMessage: Message = {
        chatId: currentChatId,
        role: 'assistant',
        content: '',
        createdAt: new Date(),
      }
      aiMessage.id = await dbLayer.addMessage(aiMessage)
      ongoingAiMessages.value.set(currentChatId, aiMessage)
      messages.value.push(aiMessage)

      let chatHistory = messages.value.slice(-(historyMessageLength.value ?? 0))
      if (systemPrompt.value) {
        chatHistory.unshift(systemPrompt.value)
      }

      const response = await ollama.chat({
        model: currentModel.value,
        messages: chatHistory,
        stream: true
      })

      for await (const part of response) {
        const aiMessage = ongoingAiMessages.value.get(currentChatId)
        if (aiMessage) {
          aiMessage.content += part.message.content
          await dbLayer.updateMessage(aiMessage.id!, { content: aiMessage.content })
          if (currentChatId === activeChat.value?.id) {
            setMessages(await dbLayer.getMessages(currentChatId))
          }
        }
      }

      ongoingAiMessages.value.delete(currentChatId)
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          ongoingAiMessages.value.delete(currentChatId)
          return
        }
      }
      console.error('Failed to add user message:', error)
    }
  }

  const regenerateResponse = async () => {
    if (!activeChat.value) return
    const currentChatId = activeChat.value.id!
    const message = messages.value[messages.value.length - 1]
    if (message && message.role === 'assistant') {
      if (message.id) db.messages.delete(message.id)
      messages.value.pop()
    }
    try {
      // Start a new AI message
      const aiMessage: Message = {
        chatId: currentChatId,
        role: 'assistant',
        content: '',
        createdAt: new Date(),
      }
      aiMessage.id = await dbLayer.addMessage(aiMessage)
      ongoingAiMessages.value.set(currentChatId, aiMessage)
      messages.value.push(aiMessage)

      let chatHistory = messages.value.slice(-(historyMessageLength.value ?? 0))
      if (systemPrompt.value) {
        chatHistory.unshift(systemPrompt.value)
      }

      const response = await ollama.chat({
        model: currentModel.value,
        messages: chatHistory,
        stream: true
      })

      for await (const part of response) {
        const aiMessage = ongoingAiMessages.value.get(currentChatId)
        if (aiMessage) {
          aiMessage.content += part.message.content
          await dbLayer.updateMessage(aiMessage.id!, { content: aiMessage.content })
          if (currentChatId === activeChat.value?.id) {
            setMessages(await dbLayer.getMessages(currentChatId))
          }
        }
      }

      ongoingAiMessages.value.delete(currentChatId)
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          ongoingAiMessages.value.delete(currentChatId)
          return
        }
      }
      console.error('Failed to regenerate response:', error)
    }
  }

  const wipeDatabase = async () => {
    try {
      await dbLayer.clearChats()
      await dbLayer.clearMessages()

      // Reset local state
      chats.value = []
      activeChat.value = null
      messages.value = []
      ongoingAiMessages.value.clear()

      await startNewChat('New chat')
    } catch (error) {
      console.error('Failed to wipe the database:', error)
    }
  }

  const deleteChat = async (chatId: number) => {
    try {
      await dbLayer.deleteChat(chatId)
      await dbLayer.deleteMessagesOfChat(chatId)

      chats.value = chats.value.filter((chat) => chat.id !== chatId)

      if (activeChat.value?.id === chatId) {
        if (sortedChats.value.length) {
          await switchChat(sortedChats.value[0].id!)
        } else {
          await startNewChat('New chat')
        }
      }
    } catch (error) {
      console.error(`Failed to delete chat with ID ${chatId}:`, error)
    }
  }

  const abort = () => {
    ongoingAiMessages.value.clear()
	ollama.abort()
  }

  const exportChats = async () => {
    const chats = await dbLayer.getAllChats()
    const exportData: ChatExport[] = []
    await Promise.all(chats.map(async chat => {
      if (!chat?.id) return
      const messages = await dbLayer.getMessages(chat.id)
      exportData.push(Object.assign({ messages }, chat))
    }))
    return exportData
  }

  const importChats = async (jsonData: ChatExport[]) => {
    jsonData.forEach(async chatData => {
      const chat: Chat = {
        name: chatData?.name,
        model: chatData?.model,
        createdAt: new Date(chatData?.createdAt || chatData.messages[0].createdAt),
      }
      chat.id = await dbLayer.addChat(chat)
      chats.value.push(chat)
      chatData.messages.forEach(async messageData => {
        const message: Message = {
          chatId: chat.id!,
          role: messageData.role,
          content: messageData.content,
          createdAt: new Date(messageData.createdAt),
        }
        await dbLayer.addMessage(message)
      })
    })
  }

  return {
	availableModels,
    chats,
    sortedChats,
    activeChat,
    messages,
    hasMessages,
    hasActiveChat,
    renameChat,
	refreshModels,
    switchModel,
    startNewChat,
    switchChat,
    deleteChat,
    addUserMessage,
    regenerateResponse,
    addSystemMessage,
    initialize,
    wipeDatabase,
    abort,
    exportChats,
    importChats,
  }
}
