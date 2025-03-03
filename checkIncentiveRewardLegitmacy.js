require('dotenv').config();
/********************************************************/
const { sequelize, checkConnection } = require('./sequelize');
var connection;

async function handleReconnect() {
    console.log('Attempting to reconnect to the database...');
    try {
        await sequelize.close(); // Close the existing connection
        await sequelize.authenticate(); // Try to reconnect
        console.log('Reconnection successful.');
    } catch (reconnectError) {
        console.error('Reconnection failed:', reconnectError);
        // Handle further reconnection attempts or fail gracefully
    }
}

async function fetchExecuteQuery(query) {
  try {
    let results;
    // console.log("fetchExecuteQuery", query);
    results = await sequelize.query(query, { type: sequelize.QueryTypes.SELECT, useMaster: false });
    // console.log("fetchExecuteQuery", results.length);

    return results;
  } catch (error) {
    console.error('Error fetching from slave:', error);
  }
}

async function insertExecuteQuery(query) {
  try {
    let results;
    // console.log("insertExecuteQuery", query);
    results = await sequelize.query(query, { type: sequelize.QueryTypes.INSERT, useMaster: true });
    console.log("insertExecuteQuery", results);

    return results;
  } catch (error) {
    console.error('Error fetching from slave:', error);
  }
}

async function updateExecuteQuery(updateQuery) {
  try {
    let results;
    // console.log("updateExecuteQuery", query);
    results = await sequelize.query(updateQuery, { type: sequelize.QueryTypes.UPDATE, useMaster: true });
    console.log("updateExecuteQuery", updateQuery, results);

    return results;
  } catch (error) {
    console.error('Error fetching from slave:', error);
  }
}
/******************************************************/

const axios = require('axios');

async function asyncForEach(array, callback) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
}

const pollInterval = 5000;

async function startListening() {
  await checkLegitMacy();

  // while(true) {
  //   await checkLegitMacy();
  //   await new Promise(resolve => setTimeout(resolve, pollInterval));
  // }
}

async function checkLegitMacy() {
  try {
    let currentPrice = 0.01;

    //incentive data
    let checkIncentiveData = `SELECT * FROM mafia_incentive_history where legitmacy_flag = 0 order by id asc`;
    console.log("checkIncentiveData", checkIncentiveData);
    const checkIncentiveDataResult = await fetchExecuteQuery(checkIncentiveData);
    console.log("checkIncentiveDataResult", checkIncentiveDataResult.length);

    let incentiveUsdt = 0;
    let incentiveToken = 0;
    if(checkIncentiveDataResult.length > 0) {
      await asyncForEach(checkIncentiveDataResult, async singIncentive => {
        console.log(singIncentive);

        currentPrice = (singIncentive?.token_price)? singIncentive?.token_price: 0.01;

        let checkQuery = `WITH RECURSIVE referral_tree AS (
                -- Base case: Start with the given user_id
                SELECT user_tg_id, referred_by, 1 AS level
                FROM mafia_referral_listing
                WHERE referred_by = '${singIncentive.telegram_id}'

                UNION ALL

                -- Recursive case: Find users referred by previous level users
                SELECT u.user_tg_id, u.referred_by, rt.level + 1
                FROM mafia_referral_listing u
                INNER JOIN referral_tree rt ON u.referred_by = rt.user_tg_id
            )
            SELECT * FROM referral_tree where user_tg_id = '${singIncentive.incentive_from}';
            `;
        console.log("checkQuery", checkQuery);
        const checkQueryDataResult = await fetchExecuteQuery(checkQuery);
        console.log("checkQueryDataResult", checkQueryDataResult.length);

        let checkLevelValue = checkQueryDataResult[0].level;

        const dateStr = singIncentive.created_at;
        const date = new Date(dateStr);

        // Subtract 1 day
        date.setDate(date.getDate() - 1);

        const resultDateNe = date.toISOString().split('T')[0]; // Extract only the date part

        let checkGameHistory = `SELECT * FROM (
                  SELECT *, 
                         ROW_NUMBER() OVER (PARTITION BY telegram_id ORDER BY result_date ASC) AS rn
                  FROM mafia_user_game_history
                  WHERE telegram_id IN ('${singIncentive.incentive_from}') 
                    AND date(result_date) = '${resultDateNe}'
              ) t
              WHERE rn = 1;`

        // console.log("checkGameHistory", checkGameHistory);
        const checkGameHistoryResult = await fetchExecuteQuery(checkGameHistory);
        console.log("checkGameHistoryResult", checkGameHistoryResult.length);

        let amount = 0;
        let tierPercentage = 0;
        let incentiveType;
        if(checkGameHistoryResult.length > 0) {
          // console.log(checkGameHistoryResult[0])
          if(checkGameHistoryResult[0].game_result == 'winner') {
            /// Token Tier incentive ///
            amount = 100;
            incentiveType = "Token";
            if (checkLevelValue === 1) {
                tierPercentage = 5; // 5% for Tier 1
            } else if (checkLevelValue === 2) {
                tierPercentage = 2; // 2% for Tier 2
            } else if (checkLevelValue === 3) {
                tierPercentage = 2;  // 2% for Tier 3
            } else if (checkLevelValue >= 4 && checkLevelValue <= 9) {
                tierPercentage = 1;  // 1% for Tiers 4 to 9
            }
          } else {
            /// USD Tier incentive ///
            amount = 3;
            incentiveType = "USD";
            if (checkLevelValue === 1) {
                tierPercentage = 13; // 13% for Tier 1
            } else if (checkLevelValue === 2) {
                tierPercentage = 10; // 10% for Tier 2
            } else if (checkLevelValue === 3) {
                tierPercentage = 5;  // 5% for Tier 3
            } else if (checkLevelValue >= 4 && checkLevelValue <= 9) {
                tierPercentage = 2;  // 2% for Tiers 4 to 9
            }
          }
        }

        incentive_amount = parseFloat(((tierPercentage / 100) * amount).toFixed(4)); //(tierPercentage / 100) * amount;

        if (incentiveType === 'Token'){
            incentive_amount = parseFloat((incentive_amount / currentPrice).toFixed(4));
        }
        console.log(singIncentive.id,`++++++++++++++++++++++++++++++`,tierPercentage, (tierPercentage / 100), parseFloat(((tierPercentage / 100) * 3).toFixed(4)), incentiveType, typeof incentive_amount, incentive_amount, singIncentive.incentive_amount)
        if(parseFloat(incentive_amount) !== parseFloat(singIncentive.incentive_amount)) {
          console.log(singIncentive.id, "~~~~~~~~~~~~~~~~~~~~~ incentive Amount Legitmacy Fails !!! ~~~~~~~~~~~~~~~~~~~~~~~~~~");
          // break;
        } else {
          // console.log("~~~~~~~~~~~~~~~~~~~~~ incentive Amount Legitmacy Approved !!! ~~~~~~~~~~~~~~~~~~~~~~~~~~");
        }
      });
    }
  } catch(err) {
    console.log(err);
  }
}

startListening();
