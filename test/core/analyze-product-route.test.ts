import { beforeEach, describe, expect, it, vi } from 'vitest';
import { analyzeProductRequestSchema } from '@/lib/core/generation/api-schema';

const { analyze } = vi.hoisted(() => ({
  analyze: vi.fn()
}));

vi.mock('@/lib/core/analysis/runtime', () => ({
  createRuntimeProductAnalyzer: () => ({
    analyze
  })
}));

import { POST } from '@/app/api/v1/analyze-product/route';

describe('POST /api/v1/analyze-product', () => {
  beforeEach(() => {
    analyze.mockReset();
    vi.restoreAllMocks();
  });

  it('returns analysis JSON when an image is provided', async () => {
    analyze.mockResolvedValue({
      productName: '空气净化器',
      targetAudience: '卧室用户',
      sellingPoints: '低噪音',
      materialDescription: 'ABS 外壳',
      usageInstructions: '轻触启动',
      category: 'Home Appliances > Air Purifiers'
    });

    const request = new Request('http://localhost/api/v1/analyze-product', {
      method: 'POST',
      body: JSON.stringify({
        sourceImageUrl: 'https://example.com/product.png',
        productInfoRaw: '  ',
        locale: 'zh'
      }),
      headers: { 'Content-Type': 'application/json' }
    });

    const response = await POST(request as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      analysis: {
        productName: '空气净化器',
        targetAudience: '卧室用户',
        sellingPoints: '低噪音',
        materialDescription: 'ABS 外壳',
        usageInstructions: '轻触启动',
        category: 'Home Appliances > Air Purifiers'
      }
    });
    expect(analyze).toHaveBeenCalledWith({
      sourceImageUrl: 'https://example.com/product.png',
      productInfoRaw: '',
      locale: 'zh',
      mode: 'product'
    });
  });

  it('returns analysis JSON when only raw product info is provided', async () => {
    analyze.mockResolvedValue({
      productName: '自动速开双人户外露营帐篷',
      targetAudience: '露营新手与家庭用户',
      sellingPoints: '秒速搭建',
      materialDescription: '190T Polyester Taffeta',
      usageInstructions: '解开捆绑后自动展开',
      category: 'Sports & Outdoors > Camping > Tents'
    });

    const request = new Request('http://localhost/api/v1/analyze-product', {
      method: 'POST',
      body: JSON.stringify({
        productInfoRaw: '  自动速开双人户外露营帐篷，适合1-2人快速露营  ',
        locale: 'zh'
      }),
      headers: { 'Content-Type': 'application/json' }
    });

    const response = await POST(request as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      analysis: {
        productName: '自动速开双人户外露营帐篷',
        targetAudience: '露营新手与家庭用户',
        sellingPoints: '秒速搭建',
        materialDescription: '190T Polyester Taffeta',
        usageInstructions: '解开捆绑后自动展开',
        category: 'Sports & Outdoors > Camping > Tents'
      }
    });
    expect(analyze).toHaveBeenCalledWith({
      productInfoRaw: '自动速开双人户外露营帐篷，适合1-2人快速露营',
      locale: 'zh',
      mode: 'product'
    });
  });

  it('passes model-image mode through to the analyzer', async () => {
    analyze.mockResolvedValue({
      productName: '男士户外机能工装裤',
      targetAudience: '金发欧美青年男模特',
      sellingPoints: '透气防水',
      materialDescription: '高强度尼龙',
      usageInstructions: '户外徒步和城市通勤',
      category: 'Clothing > Men > Pants'
    });

    const request = new Request('http://localhost/api/v1/analyze-product', {
      method: 'POST',
      body: JSON.stringify({
        sourceImageUrl: 'https://example.com/pants.png',
        productInfoRaw: '  男士户外机能工装裤  ',
        mode: 'model',
        locale: 'zh'
      }),
      headers: { 'Content-Type': 'application/json' }
    });

    const response = await POST(request as never);

    expect(response.status).toBe(200);
    expect(analyze).toHaveBeenCalledWith({
      sourceImageUrl: 'https://example.com/pants.png',
      productInfoRaw: '男士户外机能工装裤',
      locale: 'zh',
      mode: 'model'
    });
  });

  it('rejects requests without an image or raw product info', async () => {
    expect(
      analyzeProductRequestSchema.safeParse({
        sourceImageUrl: ' \n\t ',
        productInfoRaw: ' \n\t ',
        locale: 'zh'
      }).success
    ).toBe(false);

    const request = new Request('http://localhost/api/v1/analyze-product', {
      method: 'POST',
      body: JSON.stringify({
        sourceImageUrl: ' \n\t ',
        productInfoRaw: ' \n\t ',
        locale: 'zh'
      }),
      headers: { 'Content-Type': 'application/json' }
    });

    const response = await POST(request as never);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Provide a product image or raw product information first.'
    });
    expect(analyze).not.toHaveBeenCalled();
  });

  it('returns 502 when the analyzer throws', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    analyze.mockRejectedValue(new Error('upstream unavailable'));

    const request = new Request('http://localhost/api/v1/analyze-product', {
      method: 'POST',
      body: JSON.stringify({
        productInfoRaw: '空气净化器',
        locale: 'zh'
      }),
      headers: { 'Content-Type': 'application/json' }
    });

    const response = await POST(request as never);

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: 'AI 分析暂时不可用，请稍后再试。'
    });
    expect(consoleSpy).toHaveBeenCalledWith(
      'Product analysis failed',
      expect.objectContaining({
        locale: 'zh',
        hasImage: false,
        rawLength: 5,
        error: 'upstream unavailable'
      })
    );
  });

  it('returns a localized access-denied message without leaking raw provider JSON', async () => {
    analyze.mockRejectedValue(
      new Error('Alibaba Cloud Model Studio has not enabled access to qwen3-vl-plus. Enable this Qwen-VL model or configure ALI_DASHSCOPE_ANALYSIS_VISION_MODEL to a model your key can access.')
    );

    const request = new Request('http://localhost/api/v1/analyze-product', {
      method: 'POST',
      body: JSON.stringify({
        sourceImageUrl: 'https://example.com/product.png',
        productInfoRaw: '空气净化器',
        locale: 'zh'
      }),
      headers: { 'Content-Type': 'application/json' }
    });

    const response = await POST(request as never);
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.error).toBe(
      'AI 分析暂时不可用：当前账号还没有开通图片理解能力。请联系管理员检查 AI 模型权限。'
    );
    expect(body.error).not.toContain('chatcmpl');
    expect(body.error).not.toContain('request_id');
    expect(body.error).not.toMatch(/qwen/i);
  });

  it('returns a friendly localized message for internal analysis format errors', async () => {
    analyze.mockRejectedValue(new Error('Qwen visual analysis response did not include valid analysis JSON.'));

    const request = new Request('http://localhost/api/v1/analyze-product', {
      method: 'POST',
      body: JSON.stringify({
        productInfoRaw: 'Product',
        locale: 'zh'
      }),
      headers: { 'Content-Type': 'application/json' }
    });

    const response = await POST(request as never);
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.error).toBe('AI 暂时没能整理出结构化商品信息。请补充更完整的商品名称、核心卖点或使用场景后再试。');
    expect(body.error).not.toMatch(/qwen|json/i);
  });

  it('returns a friendly localized message when visual analysis did not read enough image details', async () => {
    analyze.mockRejectedValue(new Error('Image analysis did not include enough visual product details.'));

    const request = new Request('http://localhost/api/v1/analyze-product', {
      method: 'POST',
      body: JSON.stringify({
        sourceImageUrl: 'https://example.com/product.png',
        productInfoRaw: '香水',
        locale: 'zh'
      }),
      headers: { 'Content-Type': 'application/json' }
    });

    const response = await POST(request as never);
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.error).toBe('AI 暂时没有从图片中识别出足够商品细节。请换一张更清晰的主图，或补充商品卖点后再试。');
    expect(body.error).not.toMatch(/qwen|json|visual/i);
  });
});
