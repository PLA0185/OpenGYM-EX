package ch.duartesantos.opengym;
import android.app.Activity;
import android.os.Bundle;
import android.widget.TextView;
public class HealthRationaleActivity extends Activity {
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        TextView text = new TextView(this);
        int padding = (int)(24 * getResources().getDisplayMetrics().density);
        text.setPadding(padding, padding, padding, padding);
        text.setTextSize(18);
        text.setText("健康数据使用说明\n\n由你主动授权读取 Health Connect 中的步数、心率、距离和活动能量，用于展示运动记录。同步最近七天，保留来源与时间，存储在本机。\n\n不会自动上传这些记录至 AI，不自动增加饮食目标。导出个人备份时包含已保存记录。你可以在健康数据页删除本机记录，在系统中撤销权限。\n\n蓝牙心率需主动连接。训练期间记录广播样本；未授权或没有数据时显示缺失。");
        setContentView(text);
    }
}
