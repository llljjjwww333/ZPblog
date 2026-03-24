
import api from './api';

export interface UploadResponse {
  url: string;
  filename: string;
}

export const fileApi = {
  // 上传图片
  uploadImage: async (file: File): Promise<UploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await api.post<UploadResponse>('/upload/image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    return response.data;
  },
};
