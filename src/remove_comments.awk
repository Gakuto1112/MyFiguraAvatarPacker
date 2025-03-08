BEGINFILE {
    is_in_block_comment = 0
}

{
    is_first_space = 1;
    backslash_count = 0;
    is_in_string = 0;
    is_in_inline_comment = 0;
    for(i = 0; i < length($0); i++) {
        char_prev2 = substr($0, i - 1, 1) # 2文字前の文字
        char_prev = substr($0, i, 1) # 1文字前の文字
        char = substr($0, i + 1, 1) # 走査対象の文字
        char_next = substr($0, i + 2, 1) # 1文字先の文字

        # はみ出た文字はnullに置き換え
        if(i <= 1) char_prev2 = null;
        if(i == 0) char_prev = null;
        if(i == length($0) - 1) char_next = null;

        # 行始めの空白を検出
        if(char != "\t" && char != " ") is_first_space = 0;

        # エスケープ文字の検出のためにバックスラッシュの数を数える。
        if(char == "\\") backslash_count++;
        else backslash_count = 0;

        # 文字列の内外を検出
        if((char == "\"" || char == "'") && backslash_count % 2 == 0 && !is_in_string) is_in_string = 1;
        else if((char == "\"" || char == "'") && backslash_count % 2 == 0 && is_in_string) is_in_string = 0;

        if(!is_in_string) {
            # インラインコメントを検出
            if(char == "-" && char_next == "-") is_in_inline_comment = 1;

            # ブロックコメントを検出
            if(char_prev2 == "-" && char_prev == "-" && char == "[" && char_next == "[" && !is_in_block_comment) is_in_block_comment = 1;
            else if(char_prev == "]" && char == "]" && is_in_block_comment) {
                is_in_block_comment = 0;
                continue;
            }
        }

        # コメント文は出力から弾く。
        if(is_first_space || is_in_inline_comment || is_in_block_comment) continue;

        printf "%c", char;
    }
    printf "%c", "\n"
}