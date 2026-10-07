export const FAILURE_CODES=Object.freeze({
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
 if(/tls|certificate|cert_|handshake|ssl/.test(message))return {code:FAILURE_CODES.TLS,retryable:true};
 if(/abort|timeout|timed out|signal has been aborted/.test(message))return {code:FAILURE_CODES.TIMEOUT,retryable:true};
 if(status===404||input.documentMissing===true)return {code:FAILURE_CODES.DOCUMENT_MISSING,retryable:true};
 if(input.htmlChanged===true||/selector|unexpected html|layout changed/.test(message))return {code:FAILURE_CODES.HTML_CHANGED,retryable:true};
 if(input.parserMatched===false||/parser.*no match|no match/.test(message))return {code:FAILURE_CODES.PARSER_NO_MATCH,retryable:true};
 if(status>=400)return {code:FAILURE_CODES.HTTP,retryable:status>=500||status===408||status===429};
 return {code:FAILURE_CODES.UNKNOWN,retryable:true};
}

export function retryState(failure,attempts=0){
 return {status:"pending",attempts:Number(attempts)||0,lastError:null,failureCode:failure?.code||null};
}
