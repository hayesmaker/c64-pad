package com.hayesmaker64.c64pad;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Local plugins register before the bridge starts.
        registerPlugin(SaveAsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
