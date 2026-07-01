import os
import sys

# 设置环境变量优化 CPU 性能
os.environ['OMP_NUM_THREADS'] = '4'  # 限制 OpenMP 线程数
os.environ['MKL_NUM_THREADS'] = '4'  # 限制 MKL 线程数
os.environ['NUMEXPR_NUM_THREADS'] = '4'  # 限制 NumExpr 线程数

# 禁用 GPU 相关设置（因为没有 NVIDIA）
os.environ['CUDA_VISIBLE_DEVICES'] = '-1'

# 优化 PyTorch CPU 性能
os.environ['KMP_AFFINITY'] = 'granularity=fine,compact,1,0'
os.environ['KMP_BLOCKTIME'] = '0'

print("🚀 启动 LiveTalking 优化版本")
print("=" * 50)
print("优化配置：")
print("- 分辨率: 320x320")
print("- 批处理: 4")
print("- CPU 线程: 4")
print("- 目标帧率: 25 FPS")
print("=" * 50)

# 导入并运行主程序
exec(open('app.py').read())
