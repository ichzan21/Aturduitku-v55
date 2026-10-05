export const isRetryableCloudSaveError = error =>
  ["API_NETWORK_ERROR", "API_TIMEOUT"].includes(error?.code)
  || [500, 502, 503, 504, 520, 521, 522, 523, 524].includes(Number(error?.status));

export async function retryCloudSave(save, wait = ms => new Promise(resolve => setTimeout(resolve, ms))) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await save();
    } catch (error) {
      if (attempt === 2 || !isRetryableCloudSaveError(error)) throw error;
      await wait(600 * 2 ** attempt);
    }
  }
}
