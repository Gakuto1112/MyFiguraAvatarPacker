import fs from "fs";
import readline from "readline";

/**
 * READMEドキュメントの言語を示す列挙型
 */
export type FileLanguage = "en" | "jp";

/**
 * README.txtを生成するクラス
 */
class ReadmeTxtGenerator {
    /**
     * README.txtのテンプレートが置いてあるディレクトリまでのパス
     */
    private readonly TEMPLATE_DIR: string = "./templates";

    /**
     * GitHub上にあるReadmeを生成するためのテンプレートが置いてあるディレクトリまでのパス
     */
    private readonly README_TEMPLATE_DIR: string = "../../FiguraAvatarsReadmeTemplate/templates";

    /**
     * 生成したREADME.txtを出力するディレクトリ
     */
    private readonly OUTPUT_DIR: string = "../out";

    /**
     * レポジトリ名
     */
    private readonly RepositoryName: string;

    /**
     * レポジトリのオーナー名
     */
    private readonly OwnerName: string;

    /**
     * fetchして入手したマークダウンのキャッシュ
     */
    private readonly caches: {[key: string]: string} = {};

    /**
     * コンストラクタ
     * @param repositoryId レポジトリのID（<オーナー名>/<レポジトリ名>）
     */
    constructor(repositoryId: string) {
        console.log(repositoryId)
        const idSprit: string[] = repositoryId.split("/");
        this.OwnerName = idSprit[0];
        this.RepositoryName = idSprit[1];
    }

    /**
     * テキストファイルをストリームで（1行ずつ）読む。
     * @param filePath 読み込み対象のファイルパス
     * @param onReadLine 1行ずつ読み込んだ際に呼ばれるコールバック関数
     */
    private async readFileWithStream(filePath: string, onReadLine: (line: string) => void): Promise<void> {
        return new Promise((resolve: () => void) => {
            const reader: readline.Interface = readline.createInterface({input: fs.createReadStream(filePath, {encoding: "utf-8"})});
            reader.addListener("line", onReadLine);
            reader.addListener("close", () => {
                resolve();
            });
        });
    }

    /**
     * インジェクトタグ（${<tag_name>}）が見つかった時に呼ばれる関数
     * @param tagName タグの名前
     * @param fileLanguage READMEドキュメントの言語
     * @returns タグに置き換わる文字列。返された文字列がREADMEに挿入される。
     */
    protected onInjectTagFound(tagName: string, fileLanguage: FileLanguage): string {
        if(this.caches[`${tagName}_${fileLanguage}`] != undefined) return this.caches[`${tagName}_${fileLanguage}`];
        else {
            switch(tagName) {
                case "REPOSITORY_NAME":
                    this.caches[`REPOSITORY_NAME_${fileLanguage}`] = this.RepositoryName;
                    return this.caches[`REPOSITORY_NAME_${fileLanguage}`];
                default:
                    return `\${${tagName}}`;
            }
        }
    }

    /**
     * Readmeを生成する。
     * @param language Readmeが書かれている言語
     */
    private async generateReadme(language: FileLanguage): Promise<void> {
        if(!fs.existsSync(this.OUTPUT_DIR)) fs.mkdirSync(this.OUTPUT_DIR);
        const writer: fs.WriteStream = fs.createWriteStream(`${this.OUTPUT_DIR}/${language == "en" ? "README" : "お読みください"}.txt`, {encoding: "utf-8"});
        await this.readFileWithStream(`${this.TEMPLATE_DIR}/${language}.txt`, (line: string): void => {
            const injectTags: IterableIterator<RegExpMatchArray> = line.matchAll(/\${(\w+)}/g);
            let charCount: number = 0;
            for(const injectTag of injectTags) {
                writer.write(line.substring(charCount, injectTag.index));
                charCount = injectTag.index! + injectTag[0].length;
                writer.write(this.onInjectTagFound(injectTag[1], language));
            }
            writer.write(`${line.substring(charCount)}\n`);
        });
    }

    /**
     * メイン関数
     */
    public async main(): Promise<void> {
        console.info("Generating English readme...");
        await this.generateReadme("en");
        console.info("Generating Japanese readme...");
        await this.generateReadme("jp");
    }
}

if(require.main == module) {
    new ReadmeTxtGenerator(process.argv[2]).main();
}