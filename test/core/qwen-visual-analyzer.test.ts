import { describe, expect, it, vi } from 'vitest';
import { QwenVisualAnalyzer } from '@/lib/core/analysis/qwen-visual-analyzer';

describe('QwenVisualAnalyzer', () => {
  it('posts the image url and raw text to DashScope and parses JSON content', async () => {
    const fetcher = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  productName: '空气净化器',
                  targetAudience: '卧室、书房和办公室桌面用户，适合小空间空气净化需求',
                  sellingPoints: '圆柱形白色机身搭配顶部深色出风口，强调桌面摆放和安静净化',
                  materialDescription: '哑光白色塑料外壳，底部点阵进风孔和顶部涡轮式格栅清晰可见',
                  usageInstructions: '适合展示床头柜、办公桌和小房间空气净化场景',
                  category: 'Home Appliances > Air Purifiers'
                })
              }
            }
          ]
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const analyzer = new QwenVisualAnalyzer({
      apiKey: 'sk',
      endpoint: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
      textModel: 'qwen3.5-plus',
      visionModel: 'qwen3-vl-plus',
      fetcher
    });

    const result = await analyzer.analyze({
      sourceImageUrl: 'https://example.com/product.png',
      productInfoRaw: '适合桌面卧室',
      locale: 'zh'
    });

    expect(result).toEqual({
      productName: '空气净化器',
      targetAudience: '卧室、书房和办公室桌面用户，适合小空间空气净化需求',
      sellingPoints: '圆柱形白色机身搭配顶部深色出风口，强调桌面摆放和安静净化',
      materialDescription: '哑光白色塑料外壳，底部点阵进风孔和顶部涡轮式格栅清晰可见',
      usageInstructions: '适合展示床头柜、办公桌和小房间空气净化场景',
      category: 'Home Appliances > Air Purifiers'
    });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher).toHaveBeenCalledWith(
      'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer sk',
          'Content-Type': 'application/json'
        }
      })
    );
    const body = JSON.parse(fetcher.mock.calls[0]?.[1]?.body as string);
    expect(body.model).toBe('qwen3-vl-plus');
    expect(body.temperature).toBe(0.2);
    expect(body.enable_thinking).toBe(false);
    expect(body.vl_high_resolution_images).toBe(true);
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.messages[0].content).toContain('Return strict JSON');
    expect(body.messages[0].content).toContain('same language as the seller text');
    expect(body.messages[0].content).toContain('infer missing commercial details from the image');
    expect(body.messages[0].content).toContain('At least three non-empty fields must mention visible image evidence');
    expect(body.messages[1].content[0]).toEqual({
      type: 'image_url',
      image_url: { url: 'https://example.com/product.png' }
    });
    expect(body.messages[1].content[1].text).toContain('Only analyze the primary product image.');
    expect(body.messages[1].content[1].text).toContain('Mode: product image.');
    expect(body.messages[1].content[1].text).toContain('User raw product info:\n适合桌面卧室');
  });

  it('uses only the primary image for multi-image analysis', async () => {
    const fetcher = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  productName: '自动速开帐篷',
                  targetAudience: '户外露营用户',
                  sellingPoints: '快速搭建',
                  materialDescription: '防水面料',
                  usageInstructions: '展开后用地钉固定',
                  category: 'Sports & Outdoors > Camping > Tents'
                })
              }
            }
          ]
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const analyzer = new QwenVisualAnalyzer({
      apiKey: 'sk',
      endpoint: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
      textModel: 'qwen3.5-plus',
      visionModel: 'qwen3-vl-plus',
      fetcher
    });

    await analyzer.analyze({
      sourceImageUrl: 'https://example.com/primary.png',
      sourceImageUrls: [
        'https://example.com/primary.png',
        'https://example.com/reference-1.png',
        'https://example.com/reference-2.png'
      ],
      productInfoRaw: '帐篷',
      locale: 'zh'
    });

    const body = JSON.parse(fetcher.mock.calls[0]?.[1]?.body as string);
    expect(body.messages[1].content).toHaveLength(2);
    expect(body.messages[1].content[0]).toEqual(
      {
        type: 'image_url',
        image_url: { url: 'https://example.com/primary.png' }
      }
    );
    expect(body.messages[1].content[1].text).toContain('Only analyze the primary product image.');
    expect(JSON.stringify(body)).not.toContain('reference-1.png');
    expect(JSON.stringify(body)).not.toContain('reference-2.png');
  });

  it('inlines Cloudflare R2 primary images before sending them to the vision model', async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('r2.cloudflarestorage.com')) {
        return new Response(new Uint8Array([1, 2, 3]), {
          status: 200,
          headers: { 'Content-Type': 'image/png' }
        });
      }

      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  productName: '粉色玻璃香水',
                  targetAudience: '喜欢清新甜美香氛和精致梳妆台摆件的年轻女性',
                  sellingPoints: '粉色透明瓶身、银色喷头和柔和花香调性适合礼赠和日常约会使用',
                  materialDescription: '玻璃瓶身搭配金属喷头，浅粉液体和圆润瓶型带来轻盈精致的视觉质感',
                  usageInstructions: '适合电商主图、礼盒场景、梳妆台陈列和香氛细节图展示',
                  category: 'Beauty & Personal Care > Fragrance > Perfume'
                })
              }
            }
          ]
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const analyzer = new QwenVisualAnalyzer({
      apiKey: 'sk',
      endpoint: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
      textModel: 'qwen3.5-plus',
      visionModel: 'qwen3-vl-plus',
      fetcher
    });

    await analyzer.analyze({
      sourceImageUrl:
        'https://tamga-uploads.399bb06f1525c2f8a58f911706197c5e.r2.cloudflarestorage.com/uploads/product.png?X-Amz-Signature=abc',
      productInfoRaw: '香水粉色，味道清香迷人，年轻人很喜欢',
      locale: 'zh'
    });

    expect(fetcher).toHaveBeenCalledTimes(2);
    const body = JSON.parse(fetcher.mock.calls[1]?.[1]?.body as string);
    expect(body.messages[1].content[0]).toEqual({
      type: 'image_url',
      image_url: { url: 'data:image/png;base64,AQID' }
    });
    expect(JSON.stringify(body)).not.toContain('cloudflarestorage.com');
  });

  it('uses the text model when analysis has no image input', async () => {
    const fetcher = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  productName: '空气净化器',
                  targetAudience: '卧室用户',
                  sellingPoints: '低噪音',
                  materialDescription: 'ABS 外壳',
                  usageInstructions: '轻触启动',
                  category: 'Home Appliances > Air Purifiers'
                })
              }
            }
          ]
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const analyzer = new QwenVisualAnalyzer({
      apiKey: 'sk',
      endpoint: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
      textModel: 'qwen3.5-plus',
      visionModel: 'qwen3-vl-plus',
      fetcher
    });

    await analyzer.analyze({
      productInfoRaw: '卧室桌面空气净化器，低噪音，HEPA过滤',
      locale: 'zh'
    });

    const body = JSON.parse(fetcher.mock.calls[0]?.[1]?.body as string);
    expect(body.model).toBe('qwen3.5-plus');
    expect(body.temperature).toBe(0.2);
    expect(body.enable_thinking).toBe(false);
    expect(body.vl_high_resolution_images).toBeUndefined();
    expect(body.messages[1].content).toHaveLength(1);
    expect(body.messages[1].content[0].text).toContain('No product image was provided. Analyze only the seller text.');
    expect(body.messages[1].content[0].text).toContain('Mode: product image.');
    expect(body.messages[1].content[0].text).toContain('User raw product info:\n卧室桌面空气净化器，低噪音，HEPA过滤');
  });

  it('falls back to local text analysis when text-only provider content is missing', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const fetcher = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {}
            }
          ]
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const analyzer = new QwenVisualAnalyzer({
      apiKey: 'sk',
      endpoint: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
      textModel: 'qwen3.5-plus',
      visionModel: 'qwen3-vl-plus',
      fetcher
    });

    await expect(
      analyzer.analyze({
        productInfoRaw: 'Waterproof outdoor tent for 3 people. Fast setup, wind-resistant frame, compact travel bag.',
        locale: 'zh'
      })
    ).resolves.toMatchObject({
      productName: 'Waterproof outdoor tent',
      targetAudience: '3 people',
      sellingPoints: 'Fast setup, wind-resistant frame, compact travel bag.',
      materialDescription: expect.stringContaining('Waterproof outdoor tent'),
      usageInstructions: expect.stringContaining('marketplace hero images')
    });
    expect(warnSpy).toHaveBeenCalledWith(
      'Product analysis provider failed; using local text fallback',
      expect.objectContaining({
        model: 'qwen3.5-plus',
        hasImage: false,
        rawLength: 91,
        error: 'Qwen visual analysis response did not include message content.'
      })
    );
    warnSpy.mockRestore();
  });

  it('times out a stalled provider request and falls back to local text analysis', async () => {
    vi.useFakeTimers();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const fetcher = vi.fn(
      (_url: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        })
    );

    const analyzer = new QwenVisualAnalyzer({
      apiKey: 'sk',
      endpoint: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
      textModel: 'qwen3.5-plus',
      visionModel: 'qwen3-vl-plus',
      fetcher
    });

    const resultPromise = analyzer.analyze({
      productInfoRaw: 'Waterproof outdoor tent for 3 people. Fast setup, wind-resistant frame, compact travel bag.',
      locale: 'zh'
    });

    await vi.advanceTimersByTimeAsync(300_000);

    await expect(resultPromise).resolves.toMatchObject({
      productName: 'Waterproof outdoor tent',
      targetAudience: '3 people'
    });
    expect(warnSpy).toHaveBeenCalledWith(
      'Product analysis provider failed; using local text fallback',
      expect.objectContaining({
        error: 'aborted'
      })
    );
    warnSpy.mockRestore();
    vi.useRealTimers();
  });

  it('extracts bracketed product names locally when text-only provider fails', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const fetcher = vi.fn(async () => new Response('upstream timeout', { status: 504 }));

    const analyzer = new QwenVisualAnalyzer({
      apiKey: 'sk',
      endpoint: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
      textModel: 'qwen3.5-plus',
      visionModel: 'qwen3-vl-plus',
      fetcher
    });

    await expect(
      analyzer.analyze({
        productInfoRaw: '[产品名称]：GUND Cozys系列10英寸奶牛毛绒玩偶',
        locale: 'zh'
      })
    ).resolves.toMatchObject({
      productName: 'GUND Cozys系列10英寸奶牛毛绒玩偶',
      targetAudience: expect.stringContaining('GUND Cozys系列10英寸奶牛毛绒玩偶'),
      sellingPoints: expect.stringContaining('GUND Cozys系列10英寸奶牛毛绒玩偶')
    });
    warnSpy.mockRestore();
  });

  it('does not fake visual analysis with text fallback when image analysis fails', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const fetcher = vi.fn(async () =>
      new Response(
        JSON.stringify({
          error: {
            message: 'Model access denied.',
            code: 'Model.AccessDenied'
          }
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const analyzer = new QwenVisualAnalyzer({
      apiKey: 'sk',
      endpoint: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
      textModel: 'qwen3.5-plus',
      visionModel: 'qwen3-vl-plus',
      fetcher
    });

    await expect(
      analyzer.analyze({
        sourceImageUrl: 'https://example.com/product.png',
        productInfoRaw: 'Waterproof outdoor tent for 3 people. Fast setup, wind-resistant frame, compact travel bag.',
        locale: 'zh'
      })
    ).rejects.toThrow('Alibaba Cloud Model Studio has not enabled access to qwen3-vl-plus.');
    expect(warnSpy).not.toHaveBeenCalledWith(
      'Product analysis provider failed; using local text fallback',
      expect.anything()
    );
    warnSpy.mockRestore();
  });

  it('parses useful visual analysis JSON when the model wraps it in markdown text', async () => {
    const fetcher = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: [
                  'Here is the structured analysis:',
                  '```json',
                  JSON.stringify({
                  productName: '绿色哑铃',
                  targetAudience: '家庭健身用户',
                  sellingPoints: '防滑握柄，适合日常力量训练',
                  materialDescription: '绿色软胶包覆，六角防滚设计'
                }),
                  '```'
                ].join('\n')
              }
            }
          ]
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const analyzer = new QwenVisualAnalyzer({
      apiKey: 'sk',
      endpoint: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
      textModel: 'qwen3.5-plus',
      visionModel: 'qwen3-vl-plus',
      fetcher
    });

    await expect(
      analyzer.analyze({
        sourceImageUrl: 'https://example.com/dumbbell.png',
        productInfoRaw: 'Product',
        locale: 'zh'
      })
    ).resolves.toMatchObject({
      productName: '绿色哑铃',
      targetAudience: '家庭健身用户',
      sellingPoints: '防滑握柄，适合日常力量训练',
      materialDescription: '绿色软胶包覆，六角防滚设计',
      usageInstructions: ''
    });
  });

  it('rejects non-JSON visual analysis instead of pretending the image was analyzed', async () => {
    const fetcher = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: 'This is a product.'
              }
            }
          ]
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const analyzer = new QwenVisualAnalyzer({
      apiKey: 'sk',
      endpoint: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
      textModel: 'qwen3.5-plus',
      visionModel: 'qwen3-vl-plus',
      fetcher
    });

    await expect(
      analyzer.analyze({
        sourceImageUrl: 'https://example.com/dumbbell.png',
        productInfoRaw: 'Product',
        locale: 'zh'
      })
    ).rejects.toThrow('Qwen visual analysis response did not include valid analysis JSON.');
  });

  it('throws a readable error when DashScope returns a non-2xx response', async () => {
    const fetcher = vi.fn(async () => new Response('quota exceeded', { status: 429 }));
    const analyzer = new QwenVisualAnalyzer({
      apiKey: 'sk',
      endpoint: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
      textModel: 'qwen3.5-plus',
      visionModel: 'qwen3-vl-plus',
      fetcher
    });

    await expect(
      analyzer.analyze({
        sourceImageUrl: 'https://example.com/product.png',
        productInfoRaw: '',
        locale: 'zh'
      })
    ).rejects.toThrow('Qwen product analysis request failed with 429: quota exceeded');
  });

  it('returns an actionable message when DashScope denies model access', async () => {
    const fetcher = vi.fn(async () =>
      new Response(
        JSON.stringify({
          error: {
            message: 'Model access denied.',
            code: 'Model.AccessDenied'
          }
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      )
    );
    const analyzer = new QwenVisualAnalyzer({
      apiKey: 'sk',
      endpoint: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
      textModel: 'qwen3.5-plus',
      visionModel: 'qwen3-vl-plus',
      fetcher
    });

    await expect(
      analyzer.analyze({
        sourceImageUrl: 'https://example.com/product.png',
        productInfoRaw: '',
        locale: 'zh'
      })
    ).rejects.toThrow('Alibaba Cloud Model Studio has not enabled access to qwen3-vl-plus.');
  });

  it('throws a readable error when DashScope returns a malformed top-level 200 JSON body', async () => {
    const fetcher = vi.fn(async () =>
      new Response('{"choices":[', {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );
    const analyzer = new QwenVisualAnalyzer({
      apiKey: 'sk',
      endpoint: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
      textModel: 'qwen3.5-plus',
      visionModel: 'qwen3-vl-plus',
      fetcher
    });

    await expect(
      analyzer.analyze({
        sourceImageUrl: 'https://example.com/product.png',
        productInfoRaw: '',
        locale: 'zh'
      })
    ).rejects.toThrow('Qwen visual analysis response did not include valid analysis JSON.');
  });

  it('rejects malformed visual JSON content in a 200 response', async () => {
    const fetcher = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: '{"productName":'
              }
            }
          ]
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
    const analyzer = new QwenVisualAnalyzer({
      apiKey: 'sk',
      endpoint: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
      textModel: 'qwen3.5-plus',
      visionModel: 'qwen3-vl-plus',
      fetcher
    });

    await expect(
      analyzer.analyze({
        sourceImageUrl: 'https://example.com/product.png',
        productInfoRaw: '适合桌面卧室',
        locale: 'zh'
      })
    ).rejects.toThrow('Qwen visual analysis response did not include valid analysis JSON.');
  });

  it('retries once when a visual analysis response is not structured JSON', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: 'This is a denim jacket.'
                }
              }
            ]
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    productName: '复古水洗蓝短款牛仔夹克',
                    targetAudience: '喜欢街头休闲穿搭的年轻女性，适合春秋通勤和周末出街',
                    sellingPoints: '短款版型、翻领、胸前双口袋和古铜色纽扣突出复古牛仔风格',
                    materialDescription: '水洗蓝丹宁面料带有斜纹肌理、磨白质感和明线车缝细节',
                    usageInstructions: '适合搭配白色T恤、连衣裙或高腰裤拍摄电商主图和穿搭场景',
                    category: 'Women Clothing > Outerwear > Denim Jackets'
                  })
                }
              }
            ]
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

    const analyzer = new QwenVisualAnalyzer({
      apiKey: 'sk',
      endpoint: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
      textModel: 'qwen3.5-plus',
      visionModel: 'qwen3-vl-plus',
      fetcher
    });

    await expect(
      analyzer.analyze({
        sourceImageUrl: 'https://example.com/denim-jacket.webp',
        productInfoRaw: '衣服',
        locale: 'en'
      })
    ).resolves.toMatchObject({
      productName: '复古水洗蓝短款牛仔夹克',
      sellingPoints: expect.stringContaining('短款版型')
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('rejects visual analysis that only returns a product name', async () => {
    const fetcher = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  productName: '空气净化器'
                })
              }
            }
          ]
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
    const analyzer = new QwenVisualAnalyzer({
      apiKey: 'sk',
      endpoint: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
      textModel: 'qwen3.5-plus',
      visionModel: 'qwen3-vl-plus',
      fetcher
    });

    await expect(
      analyzer.analyze({
        sourceImageUrl: 'https://example.com/product.png',
        productInfoRaw: '香水',
        locale: 'zh'
      })
    ).rejects.toThrow('Image analysis did not include enough visual product details.');
  });

  it('rejects sparse visual analysis that only echoes short seller text', async () => {
    const fetcher = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  productName: '香水',
                  targetAudience: '',
                  sellingPoints: '',
                  materialDescription: '',
                  usageInstructions: '',
                  category: ''
                })
              }
            }
          ]
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
    const analyzer = new QwenVisualAnalyzer({
      apiKey: 'sk',
      endpoint: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
      textModel: 'qwen3.5-plus',
      visionModel: 'qwen3-vl-plus',
      fetcher
    });

    await expect(
      analyzer.analyze({
        sourceImageUrl: 'https://example.com/perfume.png',
        productInfoRaw: '香水',
        locale: 'en'
      })
    ).rejects.toThrow('Image analysis did not include enough visual product details.');
  });

  it('rejects generic visual analysis that only expands the seller text with filler', async () => {
    const fetcher = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  productName: '香水粉色，味道清香迷人，年轻人很喜欢',
                  targetAudience: '适合关注 香水粉色，味道清香迷人，年轻人很喜欢 品质、日常使用或礼赠需求的用户。',
                  sellingPoints: '香水粉色，味道清香迷人，年轻人很喜欢 可突出核心功能、使用体验、外观质感和适用场景。',
                  materialDescription: '可补充 香水粉色，味道清香迷人，年轻人很喜欢 的材质、工艺、包装或触感细节，让生成图更稳定。',
                  usageInstructions: '适合电商主图、卖点图、场景图和细节展示图。',
                  category: ''
                })
              }
            }
          ]
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
    const analyzer = new QwenVisualAnalyzer({
      apiKey: 'sk',
      endpoint: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
      textModel: 'qwen3.5-plus',
      visionModel: 'qwen3-vl-plus',
      fetcher
    });

    await expect(
      analyzer.analyze({
        sourceImageUrl: 'https://example.com/perfume.png',
        productInfoRaw: '香水粉色，味道清香迷人，年轻人很喜欢',
        locale: 'en'
      })
    ).rejects.toThrow('Image analysis did not include enough visual product details.');
  });

  it('rejects weak visual analysis even when seller input is already structured', async () => {
    const fetcher = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  productName: '现代简约白色仿真蝴蝶兰盆栽',
                  targetAudience: '',
                  sellingPoints: '',
                  materialDescription: '',
                  usageInstructions: '',
                  category: ''
                })
              }
            }
          ]
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
    const analyzer = new QwenVisualAnalyzer({
      apiKey: 'sk',
      endpoint: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
      textModel: 'qwen3.5-plus',
      visionModel: 'qwen3-vl-plus',
      fetcher
    });

    await expect(
      analyzer.analyze({
        sourceImageUrl: 'https://example.com/orchid.png',
        productInfoRaw:
          '[产品名称]：现代简约白色仿真蝴蝶兰盆栽\n[目标受众]：家居装饰爱好者，适用于客厅、办公室、卧室、浴室台面及婚庆宴会布置场景\n[卖点描述]：采用 Real Touch 仿真技术，触感真实且四季常青；无需浇水、修剪或日照，极低维护成本；防过敏设计，对宠物和花粉敏感者友好\n[材质描述]：花瓣由高档绢布结合聚酯纤维制成，花蕊带有细腻紫色喷点；花茎内置可塑性铁丝，支持自由造型；白色弧形花盆采用哑光ABS材质，底座覆盖高仿真绿苔藓\n[使用方式]：1. 从包装中取出盆栽并检查花头完整性；2. 握住花茎中下段，根据审美需求轻轻向外侧弯曲调整枝干弧度；3. 每月使用微湿布擦拭花瓣\n[产品类目]：Home & Kitchen > Home Decor Products > Artificial Flora > Artificial Flowers',
        locale: 'zh',
        mode: 'product'
      })
    ).rejects.toThrow('Image analysis did not include enough visual product details.');
  });

  it('does not spend provider calls when text-only seller input already has complete structured fields', async () => {
    const fetcher = vi.fn();
    const analyzer = new QwenVisualAnalyzer({
      apiKey: 'sk',
      endpoint: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
      textModel: 'qwen3.5-plus',
      visionModel: 'qwen3-vl-plus',
      fetcher
    });

    await expect(
      analyzer.analyze({
        productInfoRaw:
          '[产品名称]：现代简约白色仿真蝴蝶兰盆栽\n[目标受众]：家居装饰爱好者，适用于客厅、办公室、卧室、浴室台面及婚庆宴会布置场景\n[卖点描述]：采用 Real Touch 仿真技术，触感真实且四季常青；无需浇水、修剪或日照，极低维护成本；防过敏设计，对宠物和花粉敏感者友好\n[材质描述]：花瓣由高档绢布结合聚酯纤维制成，花蕊带有细腻紫色喷点；花茎内置可塑性铁丝，支持自由造型；白色弧形花盆采用哑光ABS材质，底座覆盖高仿真绿苔藓\n[使用方式]：1. 从包装中取出盆栽并检查花头完整性；2. 握住花茎中下段，根据审美需求轻轻向外侧弯曲调整枝干弧度；3. 每月使用微湿布擦拭花瓣\n[产品类目]：Home & Kitchen > Home Decor Products > Artificial Flora > Artificial Flowers',
        locale: 'zh',
        mode: 'product'
      })
    ).resolves.toMatchObject({
      productName: '现代简约白色仿真蝴蝶兰盆栽',
      targetAudience: expect.stringContaining('家居装饰爱好者'),
      sellingPoints: expect.stringContaining('Real Touch'),
      materialDescription: expect.stringContaining('高档绢布'),
      usageInstructions: expect.stringContaining('包装'),
      category: expect.stringContaining('Artificial Flowers')
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('still calls the vision model when complete structured seller input includes an image', async () => {
    const fetcher = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  productName: '白色仿真蝴蝶兰盆栽',
                  targetAudience: '家居软装、办公室桌面和婚庆布置用户',
                  sellingPoints: '白色花瓣、紫色花蕊点缀，绿叶和白色花盆形成清爽装饰感',
                  materialDescription: '绢布质感花瓣，可塑花茎，哑光白色盆器和仿真苔藓底座',
                  usageInstructions: '适合客厅、卧室、浴室台面、办公室和婚庆场景陈列',
                  category: 'Home & Kitchen > Artificial Flowers'
                })
              }
            }
          ]
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
    const analyzer = new QwenVisualAnalyzer({
      apiKey: 'sk',
      endpoint: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
      textModel: 'qwen3.5-plus',
      visionModel: 'qwen3-vl-plus',
      fetcher
    });

    await expect(
      analyzer.analyze({
        sourceImageUrl: 'https://example.com/orchid.png',
        productInfoRaw:
          '[产品名称]：现代简约白色仿真蝴蝶兰盆栽\n[目标受众]：家居装饰爱好者，适用于客厅、办公室、卧室、浴室台面及婚庆宴会布置场景\n[卖点描述]：采用 Real Touch 仿真技术，触感真实且四季常青；无需浇水、修剪或日照，极低维护成本；防过敏设计，对宠物和花粉敏感者友好\n[材质描述]：花瓣由高档绢布结合聚酯纤维制成，花蕊带有细腻紫色喷点；花茎内置可塑性铁丝，支持自由造型；白色弧形花盆采用哑光ABS材质，底座覆盖高仿真绿苔藓\n[使用方式]：1. 从包装中取出盆栽并检查花头完整性；2. 握住花茎中下段，根据审美需求轻轻向外侧弯曲调整枝干弧度；3. 每月使用微湿布擦拭花瓣\n[产品类目]：Home & Kitchen > Home Decor Products > Artificial Flora > Artificial Flowers',
        locale: 'zh',
        mode: 'product'
      })
    ).resolves.toMatchObject({
      productName: '白色仿真蝴蝶兰盆栽',
      sellingPoints: expect.stringContaining('白色花瓣'),
      materialDescription: expect.stringContaining('绢布质感')
    });
    expect(fetcher).toHaveBeenCalledOnce();
    const body = JSON.parse(fetcher.mock.calls[0]?.[1]?.body as string);
    expect(body.model).toBe('qwen3-vl-plus');
  });

  it('does not return fake local fields for image plus very short seller text', async () => {
    const fetcher = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  productName: '香水',
                  targetAudience: '',
                  sellingPoints: '',
                  materialDescription: '',
                  usageInstructions: '',
                  category: ''
                })
              }
            }
          ]
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
    const analyzer = new QwenVisualAnalyzer({
      apiKey: 'sk',
      endpoint: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
      textModel: 'qwen3.5-plus',
      visionModel: 'qwen3-vl-plus',
      fetcher
    });

    await expect(
      analyzer.analyze({
        sourceImageUrl: 'https://example.com/perfume.png',
        productInfoRaw: '香水',
        locale: 'zh'
      })
    ).rejects.toThrow('Image analysis did not include enough visual product details.');
  });

  it('uses apparel model-image analysis instructions when requested', async () => {
    const fetcher = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  productName: '男士户外机能工装裤',
                  targetAudience: '金发欧美青年男模特',
                  sellingPoints: '透气防水，适合户外徒步'
                })
              }
            }
          ]
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
    const analyzer = new QwenVisualAnalyzer({
      apiKey: 'sk',
      endpoint: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
      textModel: 'qwen3.5-plus',
      visionModel: 'qwen3-vl-plus',
      fetcher
    });

    await analyzer.analyze({
      sourceImageUrl: 'https://example.com/pants.png',
      productInfoRaw: '男士户外机能工装裤',
      locale: 'zh',
      mode: 'model'
    });

    const body = JSON.parse(fetcher.mock.calls[0]?.[1]?.body as string);
    expect(body.messages[0].content).toContain('fashion model image');
    expect(body.messages[0].content).not.toContain('productName=基础档案');
    expect(body.messages[0].content).toContain('Do not use framework labels as field values');
    expect(body.messages[1].content[1].text).toContain('基础档案');
    expect(body.messages[1].content[1].text).toContain('穿搭方案');
  });
});
