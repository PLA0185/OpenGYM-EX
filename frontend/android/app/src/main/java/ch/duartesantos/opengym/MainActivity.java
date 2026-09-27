package ch.duartesantos.opengym;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(XunlianCredentialPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
