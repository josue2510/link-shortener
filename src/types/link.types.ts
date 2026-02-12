export interface CreateLinkRequest {
  url: string;
}

export interface LinkResponse {
  id: string;
  originalUrl: string;
  shortCode: string;
  shortUrl: string;
  createdAt: Date;
}
