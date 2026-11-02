export const DATABASE_QUOTA_CODE = 'DATABASE_QUOTA_EXCEEDED';

export const isDatabaseQuotaError = error => Number(error?.code)===8
  || ['RESOURCE_EXHAUSTED','resource-exhausted',DATABASE_QUOTA_CODE].includes(error?.code)
  || /RESOURCE_EXHAUSTED|quota exceeded|quota limit exceeded/i.test(String(error?.message||''));

export const accountPollingDelay = status => status==='pending_review' ? 60000 : null;

export const accountSnapshotKey = (data,onboarded) => JSON.stringify({data,onboarded:Boolean(onboarded)});
