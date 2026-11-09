import { describe, expect, it } from 'vitest';
import { formatProductAnalysisForTextarea } from '@/lib/core/analysis/format-product-info';

describe('formatProductAnalysisForTextarea', () => {
  it('formats structured analysis into the product-info textarea template', () => {
    expect(
      formatProductAnalysisForTextarea({
        productName: '空气净化器',
        targetAudience: '卧室/桌面用户',
        sellingPoints: '3合1过滤系统；低噪音',
        materialDescription: '哑光白色 ABS 机身',
        usageInstructions: '轻触电源图标启动设备',
        category: 'Home Appliances > Air Purifiers'
      })
    ).toBe(
      [
        '[产品名称]：空气净化器',
        '[目标受众]：卧室/桌面用户',
        '[卖点描述]：3合1过滤系统；低噪音',
        '[材质描述]：哑光白色 ABS 机身',
        '[使用方式]：轻触电源图标启动设备',
        '[产品类目]：Home Appliances > Air Purifiers'
      ].join('\n')
    );
  });

  it('omits blank fields', () => {
    expect(
      formatProductAnalysisForTextarea({
        productName: '空气净化器',
        targetAudience: '',
        sellingPoints: ' ',
        materialDescription: 'ABS',
        usageInstructions: '',
        category: ''
      })
    ).toBe(['[产品名称]：空气净化器', '[材质描述]：ABS'].join('\n'));
  });

  it('uses the seller text language for textarea section labels', () => {
    expect(
      formatProductAnalysisForTextarea(
        {
          productName: 'Pink perfume',
          targetAudience: 'Young shoppers',
          sellingPoints: 'Soft floral scent',
          materialDescription: 'Glass bottle',
          usageInstructions: 'Daily fragrance',
          category: 'Beauty > Fragrance'
        },
        'product',
        'en'
      )
    ).toContain('[Product name]：Pink perfume');

    expect(
      formatProductAnalysisForTextarea(
        {
          productName: 'Розовый парфюм',
          targetAudience: 'Молодые покупатели',
          sellingPoints: 'Лёгкий цветочный аромат',
          materialDescription: '',
          usageInstructions: '',
          category: ''
        },
        'product',
        'en'
      )
    ).toContain('[Название товара]：Розовый парфюм');
  });

  it('uses localized apparel labels for model-image analysis', () => {
    expect(
      formatProductAnalysisForTextarea(
        {
          productName: '美式复古重工水洗廓形短款牛仔夹克',
          targetAudience: '高克重牛仔、复古水洗、短款廓形',
          sellingPoints: '春秋外搭，挺括耐穿',
          materialDescription: '适合高腰牛仔裤和复古运动鞋',
          usageInstructions: '短款廓形拉高腰线',
          category: 'Women > Jackets'
        },
        'model',
        'zh'
      )
    ).toContain('[基础档案]：美式复古重工水洗廓形短款牛仔夹克');

    expect(
      formatProductAnalysisForTextarea(
        {
          productName: 'Vintage denim jacket',
          targetAudience: 'Heavy washed denim and cropped silhouette',
          sellingPoints: 'Durable spring outerwear',
          materialDescription: 'Pairs with high-waist denim',
          usageInstructions: 'Cropped shape improves proportion',
          category: 'Women > Jackets'
        },
        'model',
        'en'
      )
    ).toContain('[Base profile]：Vintage denim jacket');
  });
});
