import json
from PIL import Image, ImageDraw, ImageFont
import os

def draw_annotations_on_image(image_path, json_path, output_path="annotated_image.jpg"):
    """
    读取JSON标注和图片，然后在图片上绘制边界框和标签。

    Args:
        image_path (str): 输入图片文件的路径 (e.g., "image.jpg").
        json_path (str): 输入JSON标注文件的路径 (e.g., "annotations.json").
        output_path (str): 输出标注后图片文件的路径 (e.g., "annotated_image.jpg").
    """
    try:
        # 1. 读取图片
        img = Image.open(image_path).convert("RGB")
        img_width, img_height = img.size
        draw = ImageDraw.Draw(img)

        # 尝试加载一个字体，如果找不到则使用默认字体
        try:
            # 尝试使用一个常见的中文支持字体，例如 'simhei.ttf' (黑体) 或 'msyh.ttc' (微软雅黑)
            # 如果这些字体在您的系统上不存在，您可能需要指定一个存在的字体路径
            # 或者下载一个字体文件并放在脚本同目录下
            font_path = "arial.ttf" # 默认英文系统字体
            if os.name == 'nt': # Windows系统
                font_path = "C:/Windows/Fonts/simhei.ttf" # 尝试黑体
                if not os.path.exists(font_path):
                    font_path = "C:/Windows/Fonts/msyh.ttc" # 尝试微软雅黑
            elif os.name == 'posix': # Linux/macOS系统
                font_path = "/System/Library/Fonts/Supplemental/Arial Unicode.ttf" # macOS
                if not os.path.exists(font_path):
                    font_path = "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc" # Linux (文泉驿微米黑)
                    if not os.path.exists(font_path):
                        font_path = "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc" # Linux (Noto CJK)

            font_size = max(12, int(img_height * 0.015)) # 根据图片高度动态调整字体大小
            font = ImageFont.truetype(font_path, font_size)
        except IOError:
            print(f"Warning: Could not load font from '{font_path}'. Using default font.")
            font = ImageFont.load_default()
            font_size = max(12, int(img_height * 0.015)) # 默认字体可能不支持设置大小，但这里保留
            # 对于load_default()，字体大小可能无法精确控制，但通常足够显示

        # 2. 读取JSON标注
        with open(json_path, 'r', encoding='utf-8') as f:
            annotations_data = json.load(f)

        # 3. 遍历标注并绘制
        for annotation in annotations_data.get("annotations", []):
            category = annotation.get("category", "unknown")
            label = annotation.get("label", category) # 优先使用label，没有则用category
            bbox_norm = annotation.get("bbox")

            if bbox_norm and len(bbox_norm) == 4:
                x_norm, y_norm, w_norm, h_norm = bbox_norm

                # 将归一化坐标转换为像素坐标
                x_px = int(x_norm * img_width)
                y_px = int(y_norm * img_height)
                w_px = int(w_norm * img_width)
                h_px = int(h_norm * img_height)

                # 计算边界框的右下角坐标
                x2_px = x_px + w_px
                y2_px = y_px + h_px

                # 绘制边界框
                draw.rectangle([x_px, y_px, x2_px, y2_px], outline="red", width=2)

                # 绘制标签文本
                # 文本位置稍微偏移，避免与框重叠
                text_x = x_px
                text_y = y_px - font_size - 2 # 向上偏移，留出一点空间

                # 如果文本超出图片顶部，则绘制在框内底部
                if text_y < 0:
                    text_y = y_px + h_px + 2

                # 绘制带背景的文本，提高可读性
                text_bbox = draw.textbbox((0,0), label, font=font) # 获取文本的实际尺寸
                text_width = text_bbox[2] - text_bbox[0]
                text_height = text_bbox[3] - text_bbox[1]

                # 确保文本背景不会超出图片边界
                text_bg_x2 = text_x + text_width + 4
                text_bg_y2 = text_y + text_height + 4

                # 绘制文本背景
                draw.rectangle([text_x, text_y, text_bg_x2, text_bg_y2], fill="red")
                # 绘制文本
                draw.text((text_x + 2, text_y + 2), label, fill="white", font=font)

            else:
                print(f"Warning: Invalid bbox format for annotation: {annotation}")

        # 4. 保存标注后的图片
        img.save(output_path)
        print(f"Annotated image saved to: {output_path}")

    except FileNotFoundError:
        print(f"Error: Image file '{image_path}' or JSON file '{json_path}' not found.")
    except json.JSONDecodeError:
        print(f"Error: Could not decode JSON from '{json_path}'. Please check JSON format.")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")

if __name__ == "__main__":
    # 示例用法：
    # 假设你的图片文件名为 'original_image.jpg'
    # 假设你的JSON标注文件名为 'annotations.json' (即我之前输出的JSON内容保存到这个文件)

    # 请将以下路径替换为你的实际文件路径
    image_file = "input.jpg" # 替换为你的图片文件名
    json_file = "input.json"   # 替换为你的JSON文件名
    output_file = "annotated_output.jpg" # 标注后图片保存的文件名

    # 创建一个示例JSON文件（如果不存在）
    if not os.path.exists(json_file):
        print(f"Creating a dummy '{json_file}' for demonstration. Please replace with your actual JSON.")
        dummy_json_content = {
          "annotations": [
            {
              "category": "app_icon",
              "label": "设置",
              "bbox": [0.050, 0.064, 0.183, 0.103]
            },
            {
              "category": "widget",
              "label": "Calendar Widget",
              "bbox": [0.033, 0.199, 0.939, 0.299]
            }
          ]
        }
        with open(json_file, 'w', encoding='utf-8') as f:
            json.dump(dummy_json_content, f, indent=2, ensure_ascii=False)

    # 运行标注函数
    draw_annotations_on_image(image_file, json_file, output_file)