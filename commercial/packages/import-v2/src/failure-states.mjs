export const FAILURE_CODES=Object.freeze({
 AUTHENTICATION:"authentication_required",
 ANTI_BOT:"anti_bot_blocked",
 ACCESS_DENIED:"access_denied",
 IDENTITY:"identity_not_found",
 FORMAT:"format_unrecognized",
 TLS:"tls_error",
 TIMEOUT:"timeout",
 DOCUMENT_MISSING:"document_missing",
 HTML_CHANGED:"html_changed",
 PARSER_NO_MATCH:"parser_no_match",
 HTTP:"http_error",
 UNKNOWN:"unknown"
});

export function classifyImportFailure(input={}){
 const message=String(input.message||input.error?.message||input.error||"").toLowerCase();
 const status=Number(input.httpStatus||input.status||0);
 if(input.antiBot===true||/turnstile|captcha|cloudflare challenge/.test(message))return {code:FAILURE_CODES.ANTI_BOT,retryable:false};
 if(status===401)return {code:FAILURE_CODES.AUTHENTICATION,retryable:false};
 if(status===403)return {code:FAILURE_CODES.ACCESS_DENIED,retryable:false};
 if(/source_identity_missing|missing external identity/.test(message))return {code:FAILURE_CODES.IDENTITY,retryable:false};
 if(input.formatUnrecognized===true)return {code:FAILURE_CODES.FORMAT,retryable:false};
 if(/tls|certificate|cert_|handshake|ssl/.test(message))return {code:FAILURE_CODES.TLS,retryable:true};
 if(/abort|timeout|timed out|signal has been aborted/.test(message))return {code:FAILURE_CODES.TIMEOUT,retryable:true};
 if(status===404||input.documentMissing===true)return {code:FAILURE_CODES.DOCUMENT_MISSING,retryable:true};
 if(input.htmlChanged===true||/selector|unexpected html|layout changed/.test(message))return {code:FAILURE_CODES.HTML_CHANGED,retryable:true};
 if(input.parserMatched===false||/parser.*no match|no match/.test(message))return {code:FAILURE_CODES.PARSER_NO_MATCH,retryable:true};
 if(status>=400)return {code:FAILURE_CODES.HTTP,retryable:status>=500||status===408||status===429};
 return {code:FAILURE_CODES.UNKNOWN,retryable:true};
}

export function retryDecision(failure,attempts,{maxAttempts=5,baseDelayMs=60000,maxDelayMs=3600000}={}){
 const attempt=Number(attempts);
 if(!Number.isSafeInteger(attempt)||attempt<1)throw new RangeError('attempts must include the current attempt');
 if(!failure?.retryable)return {status:'blocked',delayMs:null};
 if(attempt>=maxAttempts)return {status:'failed',delayMs:null};
 return {status:'pending',delayMs:Math.min(maxDelayMs,baseDelayMs*2**(attempt-1))};
}

export function retryState(failure,attempts=0){
 return {status:"pending",attempts:Number(attempts)||0,lastError:null,failureCode:failure?.code||null};
}

