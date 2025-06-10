import { ref } from 'vue'
import { provider } from './appConfig.ts'
import { Message } from './database.ts'
import { openai, ollama, anthropic } from 'fluent-ai'

export type ChatRequest = {
	model: string
	messages?: Message[]
}

export type ChatMessage = {
	role: string
	content: string
}

export type ChatCompletedResponse = {
	model: string
	created_at: string
	message: ChatMessage
	done: boolean
	total_duration: number
	load_duration: number
	prompt_eval_count: number
	prompt_eval_duration: number
	eval_count: number
	eval_duration: number
}

export type ChatPartResponse = {
	model: string
	created_at: string
	message: ChatMessage
	done: boolean
}

export type ChatResponse = ChatCompletedResponse | ChatPartResponse;


export const useApi = () => {
	const error = ref(null)

	const getProvider = () => {
		switch (provider.value) {
			case 'openai':
				return openai()
			case 'ollama':
				return ollama()
			case 'anthropic':
				return anthropic()
			default:
				throw new Error(`Unsupported provider: ${provider.value}`)
		}
	}

	const generateChat = async (
		request: ChatRequest,
		onDataReceived: (data: ChatPartResponse) => void,
	): Promise<ChatResponse[]> => {
		try {
			const job = getProvider()
				.chat(request.model)
				.messages(request.messages?.map(m => ({ role: m.role, content: m.content })) || [])
				.stream()

			const { stream } = await job.run()
			const results: ChatPartResponse[] = []

			for await (const chunk of stream) {
				const response: ChatPartResponse = {
					model: request.model,
					created_at: new Date().toISOString(),
					message: {
						role: 'assistant',
						content: chunk.text ?? '',
					},
					done: false,
				}

				onDataReceived(response)
				results.push(response)
			}

			// Final response marking done=true
			results.push({
				...results[results.length - 1],
				done: true,
			})

			return results
		} catch (err) {
			console.error(err)
			throw err
		}
	}

	const listModels = async () => {	
		try {
			const job = getProvider().listModels()
			const { models } = await job.run()
			console.log(models)
			return models
		} catch (err: any) {
			console.error(err)
			throw err
		}
	}

	// All other model management functions using fetch can be removed
	// or refactored later based on actual support by `fluent-ai`.
	// For now, they are left intact if needed by Ollama directly.

	const abortController = ref<AbortController>(new AbortController())
	const signal = ref<AbortSignal>(abortController.value.signal)

	const abort = () => {
		if (abortController.value) {
			abortController.value.abort()
			abortController.value = new AbortController()
			signal.value = abortController.value.signal
			console.log('Fetch request aborted and controller reset')
		}
	}

	return {
		error,
		generateChat,
		listModels,
		abort
	}
}


const generateChat = async (
    request: ChatRequest,
    onDataReceived: (data: any) => void,
  ): Promise<any[]> => {
    const res = await fetch(getApiUrl('/chat'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      signal: signal.value,
    })

    if (!res.ok) {
      throw new Error('Network response was not ok')
    }

    const reader = res.body?.getReader()
    let results: ChatResponse[] = []

    if (reader) {
      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          break
        }

        try {
          const chunk = new TextDecoder().decode(value)
          const parsedChunk: ChatPartResponse = JSON.parse(chunk)

          onDataReceived(parsedChunk)
          results.push(parsedChunk)
        } catch (e) {
          // Carry on...
        }
      }
    }

    return results
  }



  // List local models
  const listLocalModels = async (): Promise<ListLocalModelsResponse> => {
    const response = await fetch(getApiUrl('/tags'), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    return await response.json()
  }












