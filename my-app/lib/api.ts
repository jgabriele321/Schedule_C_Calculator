const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"

console.log('API_BASE_URL configured as:', API_BASE_URL)

export const api = {
  async get(endpoint: string) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`)
    if (!response.ok) throw new Error("API call failed")
    return response.json()
  },

  async post(endpoint: string, data: unknown) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (!response.ok) throw new Error("API call failed")
    return response.json()
  },

  async uploadCSV(file: File, source: string) {
    const formData = new FormData()
    formData.append("file", file)
    formData.append("source", source)

    console.log(`Uploading to: ${API_BASE_URL}/upload-csv`)
    console.log(`File: ${file.name}, Size: ${file.size}, Source: ${source}`)

    const response = await fetch(`${API_BASE_URL}/upload-csv`, {
      method: "POST",
      body: formData,
    })
    
    console.log(`Upload response status: ${response.status}`)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Upload failed: ${response.status} - ${errorText}`)
      throw new Error(`Upload failed: ${response.status} - ${errorText}`)
    }
    
    const result = await response.json()
    console.log('Upload result:', result)
    return result
  },

  async toggleBusiness(transactionId: string, isBusiness: boolean) {
    return this.post("/toggle-business", {
      transaction_id: transactionId,
      is_business: isBusiness,
    })
  },

  async toggleAllBusiness(isBusiness: boolean, filters?: {
    cardFilter?: string
    typeFilter?: string
    idList?: string[]
  }) {
    return this.post("/toggle-all-business", {
      is_business: isBusiness,
      ...(filters?.cardFilter && { card_filter: filters.cardFilter }),
      ...(filters?.typeFilter && { type_filter: filters.typeFilter }),
      ...(filters?.idList && { id_list: filters.idList }),
    })
  },

  async clearAllData() {
    return this.post("/clear-all-data", {})
  },
}
