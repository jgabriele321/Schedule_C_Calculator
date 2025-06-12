const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"

export const api = {
  async get(endpoint: string) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`)
    if (!response.ok) throw new Error("API call failed")
    return response.json()
  },

  async post(endpoint: string, data: any) {
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

    const response = await fetch(`${API_BASE_URL}/upload-csv`, {
      method: "POST",
      body: formData,
    })
    if (!response.ok) throw new Error("Upload failed")
    return response.json()
  },
}
