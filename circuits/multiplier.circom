pragma circom 2.2.3;

template Multiplier() {
    signal input a;
    signal input b;
    signal input c;
    a * b === c;
}

component main {public [c]} = Multiplier();
