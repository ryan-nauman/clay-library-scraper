require('dotenv').config();
import puppeteer, { ElementHandle } from 'puppeteer';

(async () => {
  if (!process.env.LIBRARY_USERNAME || !process.env.LIBRARY_PASSWORD) {
    throw new Error('credentials missing');
  }

  let puppetOptions = {
    args: [`--window-size=${1280},${1024}`],
    defaultViewport: null,
  };
  if (process.env.LIBRARY_IS_DEBUG === '1') {
    Object.assign(puppetOptions, {
      headless: false,
      devtools: true,
    });
  }

  const browser = await puppeteer.launch(puppetOptions);

  const page = await browser.newPage();
  await page.goto('http://insignia.claycountygov.com/Library/Login?goto=Loan');

  const username = await page.$('#UserName');
  await username?.focus();
  await username?.type(process.env.LIBRARY_USERNAME);

  const password = await page.$('#Password');
  await password?.focus();
  await password?.type(process.env.LIBRARY_PASSWORD);

  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.click('.btnLogin')]);

  // scrape member data
  const memberData = await page.$$eval('#cboFamily_Loan_listbox li', (membersListItems) => {
    // skip special "<ALL>" list item
    const membersDirty = membersListItems.slice(0, membersListItems.length - 1);
    const members = membersDirty.map((li) => {
      return { name: li.textContent, id: li.getAttribute('data-offset-index'), books: null };
    });
    return members;
  });

  const bookScraper = async () => {
    let currentMemberTotalItems = '0';
    let currentPageSize = '0';
    try {
      currentMemberTotalItems = (await page.$eval('#divLoanTopText span', (el) => el.textContent)) as string;
      currentPageSize = (await page.$eval('#divLoanTopText span:nth-child(3)', (el) => el.textContent)) as string;
    } catch (e) {
      // no books checked out for this member
    }

    const pageSize = parseInt(currentPageSize, 10);
    const totalItems = parseInt(currentMemberTotalItems, 10);

    if (totalItems <= 0) {
      return [];
    } else {
      if (pageSize < totalItems) {
        // increase page size
        console.log('increasing page size');
        const pageSizeList = await page.click('input[name=pageLoanTop_input] ~ .k-select .k-i-arrow-s');
        const pageSizeListItems = await page.$$('#pageLoanTop_listbox li');
        // selectors lack accuracy, match by text instead
        for (const listItem of pageSizeListItems) {
          const textContent: string = await page.evaluate((el) => el.innerText, listItem);
          if (textContent.indexOf('100') !== -1) {
            await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), listItem.click()]);
            break;
          }
        }
      }

      // scrape books
      const books = await page.$$('.ItemTitleList');
      const bookData = [];
      for (const book of books) {
        const title = await book.$eval('span[name=ItemTitleAlink]', (el) => el.textContent);
        let dueDate = null;
        const labelSpam = await book.$$('span.Itemlbltitle');
        let isNext = false;
        for (const label of labelSpam) {
          const labelText: string = await page.evaluate((el) => el.innerText, label);
          if (isNext) {
            dueDate = labelText;
          }
          isNext = labelText.toLowerCase().indexOf('due date') !== -1;
        }
        debugger;
        bookData.push({ title, dueDate });
      }

      // console.log(bookData);
      return bookData;
    }
  };

  // by default the first member loans are shown, so scrape now, then iterate 2+
  const bookData = await bookScraper();
  memberData[0].books = bookData as any;

  for (let i = 1; i < memberData.length; i++) {
    const member = memberData[i];
    // navigate to member before iterating
    await page.click('input[name=cboFamily_Loan_input] ~ .k-select .k-i-arrow-s');
    const listItems = await page.$$('#cboFamily_Loan_listbox li');
    for (const li of listItems) {
      const text = await page.evaluate((el: HTMLElement) => el.innerText, li);
      const id = await page.evaluate((el: HTMLElement) => el.getAttribute('data-offset-index'), li);
      if (id === member.id) {
        console.log('clicking...', text);
        await page.waitForTimeout(500);
        await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), li.click()]);
        const bookData = await bookScraper();
        member.books = bookData as any;
        break;
      }
    }
  }

  console.log(JSON.stringify(memberData, null, 2));
  await browser.close();
})();
