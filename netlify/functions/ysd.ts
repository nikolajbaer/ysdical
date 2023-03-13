import { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import axios from 'axios'
import * as cheerio from 'cheerio';
import {DateTime} from 'luxon';

type ScheduleItem = {
  text: string;
  start:string;
  end:string;
  title:string;
}

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  const response = await axios({
    method:'get',
    url: 'https://classembed.upacedev.com/schedule/88?gym=Mission+Valley+YMCA',
  })
  const $ = cheerio.load(response.data)

  // Extract Week

  // Build table
  const htmlTable = $('#schedule-table')
  const title = htmlTable.parent().siblings('div').text().trim()
  const table:string[][] = []
  const rows = Array.from($('#schedule-table > tbody > tr'))
  rows.forEach( row => {
    const cells = Array.from($('th,td',row))
    table.push(cells.map( cell => $(cell).text().trim()));
  })

  // Extract start date
  const monday = new Date(Date.parse(title.replace("Schedule for week of ","")))
  const days = table[0].slice(1).map( (_,i) => {
    const day = DateTime.fromJSDate(monday).setZone('America/Los_Angeles');
    day.plus({days:i-1});
    return {day:day.day,month:day.month,year:day.year}
  })

  // rip into classes
  const items:ScheduleItem[] = []


  // Argh embedded tables
  table.slice(1).forEach(hour => {
    hour.slice(1).map( (text,i) => {
      const lines = text.split('\n').map(line => line.trim()).filter(line => line !== '')
      if(lines.length === 0) return null
      const times = lines[0].split('-').map(t => {
        const hm = /(\d+):(\d+)(am|pm)/.exec(t.trim()) ?? [0,0,0,'am']
        const hour = Number(hm[1])
        return {hour:hm[3]==='pm'?hour+12:hour,minute:Number(hm[2])}
      })
      const item:ScheduleItem = {
        text: text,
        start: `${i} ${JSON.stringify(days[i])} ${JSON.stringify(times[0])}`,
        end: `${i} ${JSON.stringify(days[i])} ${JSON.stringify(times[1])}`,
        title: lines[1],
      }
      items.push(item)
    })
  })


  // TODO apply filter
  // TODO make iCal

  return {
    statusCode: 200,
    body: JSON.stringify({title:title,schedule:items,days:`${days}`}),
    headers: {
      "Content-Type":"text/json",
    }
  };
};
