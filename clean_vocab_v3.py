import re
import json
import html


INPUT_FILE = "所有牌组.txt"
OUTPUT_FILE = "japanese_vocab_v3.json"


def clean_html(text):
    if not text:
        return ""

    text = html.unescape(text)

    # 删除 html 标签
    text = re.sub(r"<[^>]+>", "", text)

    return text.strip()


def extract_lesson(deck):
    """
    みんなの日本語 初級::第０５課 単語
    """
    match = re.search(r"第([０-９0-9]+)課", deck)

    if not match:
        return None

    num = match.group(1)

    # 全角数字转半角
    num = num.translate(
        str.maketrans(
            "０１２３４５６７８９",
            "0123456789"
        )
    )

    return int(num)


def extract_audio(field):
    """
    [sound:xxx.mp3]
    """

    match = re.search(
        r"\[sound:(.*?)\]",
        field
    )

    if not match:
        return ""

    return match.group(1)


def parse_display(display):
    """
    昼[ひる]休[やす]み

    ->
    [
      {
       text: 昼,
       reading: ひる,
       type: kanji
      }
    ]

    """

    segments = []

    i = 0

    while i < len(display):

        char = display[i]

        # 找到 汉字[假名]
        if i + 1 < len(display) and display[i+1] == "[":

            end = display.find("]", i)

            if end != -1:

                reading = display[i+2:end]

                segments.append(
                    {
                        "text": char,
                        "reading": reading,
                        "type": "kanji"
                    }
                )

                i = end + 1
                continue


        # 普通假名/符号
        if segments and segments[-1]["type"] == "kana":
            segments[-1]["text"] += char

        else:
            segments.append(
                {
                    "text": char,
                    "reading": "",
                    "type": "kana"
                }
            )

        i += 1


    return segments


def segments_to_word(segments):

    return "".join(
        x["text"]
        for x in segments
    )


def segments_to_reading(segments):

    result = ""

    for x in segments:

        if x["reading"]:
            result += x["reading"]

        else:
            result += x["text"]

    return result



def main():

    vocab = []

    with open(
        INPUT_FILE,
        "r",
        encoding="utf-8"
    ) as f:

        lines = f.readlines()


    idx = 1


    for line in lines:

        fields = line.rstrip("\n").split("\t")


        if len(fields) < 8:
            continue


        deck = fields[2]

        if "みんなの日本語" not in deck:
            continue


        lesson = extract_lesson(deck)

        if not lesson:
            continue


        display = fields[3].strip()

        if not display:
            continue


        pitch = fields[4].strip()

        pos = fields[5].strip()


        meaning = fields[8] if len(fields) > 8 else ""

        meaning = clean_html(
            meaning
        )


        sound = ""

        for f in fields:

            if "[sound:" in f:

                sound = extract_audio(f)
                break



        segments = parse_display(display)


        word = segments_to_word(
            segments
        )

        reading = segments_to_reading(
            segments
        )


        vocab.append(
            {
                "id": idx,
                "lesson": lesson,

                "word": word,

                "reading": reading,

                "segments": segments,

                "meaning": meaning,

                "part_of_speech": pos,

                "pitch": pitch,

                "audio": sound,

                "display_original": display
            }
        )


        idx += 1



    with open(
        OUTPUT_FILE,
        "w",
        encoding="utf-8"
    ) as f:

        json.dump(
            vocab,
            f,
            ensure_ascii=False,
            indent=2
        )


    print(
        f"完成，共生成 {len(vocab)} 个单词"
    )



if __name__ == "__main__":
    main()