// 短信发送通道。阶段 1 为 sandbox:不真正发短信,把验证码记录到日志,
// 并允许接口在非生产环境回传验证码(便于联调)。阶段 3 客户提供短信网关凭证后,
// 在此实现真实发送(只改这一处,上层不变)。
export interface SmsSender {
  // 返回是否「真实发出」(sandbox 恒为 false,表示验证码需走 debug 回传)
  send(phone: string, code: string): Promise<{ delivered: boolean }>;
}

export function createSandboxSmsSender(): SmsSender {
  return {
    async send() {
      // sandbox:不真实发短信;验证码经 requestOtp 的 debugCode 回传给前端联调(不再写服务端日志暴露 OTP)
      return { delivered: false };
    }
  };
}
